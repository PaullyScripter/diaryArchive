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

import threading
import time

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

_START_TIME = time.time()


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
        uptime = time.time() - _START_TIME

    out = []
    out.append("# HELP process_uptime_seconds Time since the process started")
    out.append("# TYPE process_uptime_seconds gauge")
    out.append(f"process_uptime_seconds {uptime:.0f}")

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

    out.append("# HELP task_last_run_seconds Epoch timestamp of last periodic run")
    out.append("# TYPE task_last_run_seconds gauge")
    for task, meta in sorted(task_runs.items()):
        ts = meta.get("last_run_ts", 0)
        out.append(f'task_last_run_seconds{{task="{_escape(task)}"}} {ts:.0f}')

    # Per-task scalar summaries (e.g. counts of orphans removed, items indexed).
    # Nested dicts are flattened into dot-separated keys so the full cleanup
    # summary renders as individual gauges.
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
