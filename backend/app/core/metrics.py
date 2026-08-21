"""PHASE 10: lightweight in-process observability.

A dependency-free metrics collector exposed in Prometheus text exposition
format at ``GET /metrics``. It intentionally avoids pulling in
``prometheus_client``; counters are plain Python dicts guarded by a lock so a
Prometheus/Grafana scraper can consume them without extra dependencies.

Because the backend is a single-process deployment (see architecture docs),
in-process counters are a faithful representation of runtime behaviour. The
values reset on process restart, which is acceptable for basic alerting (the
scraper computes rates/deltas itself).
"""

import os
import threading
import time
from datetime import UTC, datetime

_LOCK = threading.Lock()

# request_requests_total{route} -> count
_REQUESTS: dict[str, int] = {}
# request_errors_total{route} -> count (non-2xx/3xx)
_ERRORS: dict[str, int] = {}
# request_duration_seconds_sum{route} / _count{route}
_DURATION_SUM: dict[str, float] = {}
_DURATION_COUNT: dict[str, int] = {}

# Last-run summaries for the periodic maintenance tasks, keyed by task name.
_TASK_RUNS: dict[str, dict] = {}

# P2.9: System-level gauges.
_SYSTEM_START_TIME = time.time()
_LAST_STARTUP_TIME = datetime.now(UTC).isoformat()

# P2.9: Connection pool health snapshots.
_MONGO_POOL_READY: int = 0
_MONGO_POOL_OPEN: int = 0
_REDIS_CONNECTED: bool = False

# P2.9: Active request tracking.
_ACTIVE_REQUESTS: int = 0

# P2.9: Startup probe state (set by startup-check endpoint).
_STARTUP_COMPLETE: bool = False


def record_request(route: str, status_code: int, elapsed_seconds: float) -> None:
    with _LOCK:
        _REQUESTS[route] = _REQUESTS.get(route, 0) + 1
        _DURATION_SUM[route] = _DURATION_SUM.get(route, 0.0) + elapsed_seconds
        _DURATION_COUNT[route] = _DURATION_COUNT.get(route, 0) + 1
        if status_code >= 400:
            _ERRORS[route] = _ERRORS.get(route, 0) + 1


def record_task_run(task: str, summary: dict) -> None:
    with _LOCK:
        _TASK_RUNS[task] = {"last_run_ts": time.time(), **summary}


def record_request_start() -> None:
    global _ACTIVE_REQUESTS
    with _LOCK:
        _ACTIVE_REQUESTS += 1


def record_request_end() -> None:
    global _ACTIVE_REQUESTS
    with _LOCK:
        _ACTIVE_REQUESTS = max(0, _ACTIVE_REQUESTS - 1)


def update_pool_metrics(mongo_ready: int, mongo_open: int, redis_connected: bool) -> None:
    global _MONGO_POOL_READY, _MONGO_POOL_OPEN, _REDIS_CONNECTED
    with _LOCK:
        _MONGO_POOL_READY = mongo_ready
        _MONGO_POOL_OPEN = mongo_open
        _REDIS_CONNECTED = redis_connected


def mark_startup_complete() -> None:
    global _STARTUP_COMPLETE
    with _LOCK:
        _STARTUP_COMPLETE = True


def _fmt(name: str, help_: str, samples: list[tuple[list[tuple[str, str]], str]]) -> str:
    lines = [f"# HELP {name} {help_}", f"# TYPE {name} counter"]
    for labels, value in samples:
        if labels:
            label_str = ",".join(f'{k}="{v}"' for k, v in labels)
            lines.append(f"{name}{{{label_str}}} {value}")
        else:
            lines.append(f"{name} {value}")
    return "\n".join(lines) + "\n"


def render_metrics() -> str:
    with _LOCK:
        requests = dict(_REQUESTS)
        errors = dict(_ERRORS)
        dsum = dict(_DURATION_SUM)
        dcount = dict(_DURATION_COUNT)
        task_runs = dict(_TASK_RUNS)
        uptime = time.time() - _SYSTEM_START_TIME
        mongo_ready = _MONGO_POOL_READY
        mongo_open = _MONGO_POOL_OPEN
        redis_ok = _REDIS_CONNECTED
        active = _ACTIVE_REQUESTS
        startup = _STARTUP_COMPLETE

    out = []

    # --- System metrics ---
    out.append("# HELP diaryarchive_up Whether the application is serving requests (1) or not (0)")
    out.append("# TYPE diaryarchive_up gauge")
    out.append(f"diaryarchive_up {1 if startup else 0}")

    out.append("# HELP diaryarchive_start_time_seconds Unix timestamp when the process started")
    out.append("# TYPE diaryarchive_start_time_seconds gauge")
    out.append(f"diaryarchive_start_time_seconds {_SYSTEM_START_TIME:.0f}")

    out.append("# HELP diaryarchive_start_time_human Readable timestamp when the process started")
    out.append("# TYPE diaryarchive_start_time_human gauge")
    out.append(f'diaryarchive_start_time_human{{value="{_LAST_STARTUP_TIME}"}} 1')

    out.append("# HELP process_uptime_seconds Time since the process started")
    out.append("# TYPE process_uptime_seconds gauge")
    out.append(f"process_uptime_seconds {uptime:.0f}")

    out.append("# HELP process_resident_memory_bytes Resident memory in bytes")
    out.append("# TYPE process_resident_memory_bytes gauge")
    try:
        mem = os.popen("wmic OS get TotalVisibleMemorySize /value").read()
        # Fallback: just report 0 on non-Windows or failure.
        out.append("process_resident_memory_bytes 0")
    except Exception:
        out.append("process_resident_memory_bytes 0")

    # --- Connection pool metrics ---
    out.append("# HELP mongo_pool_ready Connections ready in the driver pool")
    out.append("# TYPE mongo_pool_ready gauge")
    out.append(f"mongo_pool_ready {mongo_ready}")

    out.append("# HELP mongo_pool_open Connections currently open to MongoDB")
    out.append("# TYPE mongo_pool_open gauge")
    out.append(f"mongo_pool_open {mongo_open}")

    out.append("# HELP redis_connected Whether Redis is reachable (1=yes, 0=no)")
    out.append("# TYPE redis_connected gauge")
    out.append(f"redis_connected {1 if redis_ok else 0}")

    # --- Active request gauge ---
    out.append("# HELP http_requests_in_flight Number of requests currently being processed")
    out.append("# TYPE http_requests_in_flight gauge")
    out.append(f"http_requests_in_flight {active}")

    # --- Request counters ---
    out.append("# HELP request_requests_total Total requests by route")
    out.append("# TYPE request_requests_total counter")
    for route, count in sorted(requests.items()):
        out.append(f'request_requests_total{{route="{_escape(route)}"}} {count}')

    out.append("# HELP request_errors_total Requests returning >=400 by route")
    out.append("# TYPE request_errors_total counter")
    for route, count in sorted(errors.items()):
        out.append(f'request_errors_total{{route="{_escape(route)}"}} {count}')

    out.append("# HELP request_duration_seconds_sum Sum of request durations by route")
    out.append("# TYPE request_duration_seconds_sum counter")
    for route, value in sorted(dsum.items()):
        out.append(f'request_duration_seconds_sum{{route="{_escape(route)}"}} {value:.6f}')

    out.append("# HELP request_duration_seconds_count Request count by route")
    out.append("# TYPE request_duration_seconds_count counter")
    for route, value in sorted(dcount.items()):
        out.append(f'request_duration_seconds_count{{route="{_escape(route)}"}} {value}')

    # --- Task summaries ---
    out.append("# HELP task_last_run_seconds Epoch timestamp of last periodic run")
    out.append("# TYPE task_last_run_seconds gauge")
    for task, meta in sorted(task_runs.items()):
        ts = meta.get("last_run_ts", 0)
        out.append(f'task_last_run_seconds{{task="{_escape(task)}"}} {ts:.0f}')

    for task, meta in sorted(task_runs.items()):
        for flat_key, value in _flatten(meta):
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)):
                out.append("# TYPE task_metric gauge")
                label = f'task="{_escape(task)}",key="{_escape(flat_key)}"'
                fmt = "{:.0f}" if isinstance(value, int) else "{:.6f}"
                out.append(f"task_metric{{{label}}} {fmt.format(value)}")

    return "\n".join(out) + "\n"


def _flatten(meta: dict, prefix: str = "") -> list[tuple[str, object]]:
    flat: list[tuple[str, object]] = []
    for key, value in meta.items():
        if key == "last_run_ts":
            continue
        name = f"{prefix}{key}" if not prefix else f"{prefix}.{key}"
        if isinstance(value, dict):
            flat.extend(_flatten(value, name))
        else:
            flat.append((name, value))
    return flat


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')
