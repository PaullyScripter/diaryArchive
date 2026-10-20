# Monitoring & Observability

This document describes the monitoring stack for DiaryArchive production deployments.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│  Prometheus │────▶│   Grafana   │
│  /metrics   │     │  (scrape)   │     │  (dashboards)│
└─────────────┘     └─────────────┘     └─────────────┘
                                            ▲
┌─────────────┐     ┌─────────────┐         │
│   Nginx     │────▶│   Promtail  │─────────│
│  (access)   │     │  (collect)  │   ┌─────┴─────┐
└─────────────┘     └──────┬──────┘   │   Loki    │
                           │          │  (logs)   │
┌─────────────┐            │          └───────────┘
│   Docker    │────────────┘
│  (containers)│
└─────────────┘
```

## Services

### Prometheus
- **Purpose:** Metrics collection and storage
- **Port:** 9090 (internal only)
- **Config:** `docker/prometheus/prometheus.yml`
- **Retention:** 30 days
- **Scrape interval:** 15s

### Loki
- **Purpose:** Log aggregation
- **Port:** 3100 (internal only)
- **Config:** `docker/loki/config.yaml`
- **Retention:** 30 days
- **Storage:** Local filesystem

### Promtail
- **Purpose:** Log collection from Docker containers
- **Port:** 9080 (internal only)
- **Config:** `docker/promtail/config.yaml`
- **Sources:** Docker JSON log files, system logs, Nginx access logs. Promtail
  does not mount or access the Docker daemon socket.

### Grafana
- **Purpose:** Visualization dashboards
- **Port:** 3000 inside the monitoring network; it is not published directly.
- **Access:** use the authenticated internal reverse proxy or an SSH tunnel.
  Never expose Grafana directly to the public internet.
- **Credentials:** Set via `GRAFANA_PASSWORD` env var

## Dashboards

### System Dashboard
- CPU usage
- Memory usage
- Disk usage
- Uptime

### Requests Dashboard
- Request rate by status code
- Response time percentiles (p50, p95, p99)
- Top 10 slowest endpoints
- Latency distribution heatmap

## Deployment

### With Monitoring
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

### Without Monitoring
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Metrics Endpoint

The backend exposes Prometheus-format metrics at:
```
GET /api/v1/metrics
```

### Available Metrics
- `http_requests_total` — Total HTTP requests
- `http_request_duration_seconds` — Request duration histogram
- `http_requests_active` — Active requests gauge
- `http_errors_total` — Total error responses
- `app_uptime_seconds` — Application uptime
- `mongodb_connections_active` — MongoDB connection pool
- `redis_connections_active` — Redis connection pool

## Alerting

### Recommended Alerts
1. **High error rate:** > 5% errors for 5 minutes
2. **High latency:** p95 > 1s for 5 minutes
3. **Service down:** Health check fails for 2 minutes
4. **Disk usage:** > 85% usage
5. **Memory usage:** > 90% usage

### Setting Up Alertmanager
1. Deploy Alertmanager alongside Prometheus
2. Configure receivers (Slack, email, PagerDuty)
3. Add alerting rules to Prometheus config

## Log Queries

### Loki LogQL Examples
```logql
# All backend errors
{service="backend"} |= "error"

# Failed login attempts
{service="backend"} |= "login" |= "failed"

# Slow requests (> 1s)
{service="backend"} | json | duration > 1s

# Nginx 5xx errors
{job="nginx"} | status >= 500

# MongoDB slow queries
{service="mongodb"} |= "slow"
```

## Troubleshooting

### Grafana not loading
- Check Grafana container logs: `docker logs grafana`
- Verify datasource connectivity: Grafana > Settings > Data Sources > Test

### Prometheus not scraping
- Check Prometheus targets: `http://prometheus:9090/targets`
- Verify network connectivity between Prometheus and targets

### Loki not receiving logs
- Check Promtail logs: `docker logs promtail`
- Verify Loki is ready: `http://loki:3100/ready`
- Check Promtail targets in Grafana > Explore > Loki > Targets
