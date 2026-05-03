# Load Test and SLO Validation

## Objective

Validate read-heavy preview API throughput and latency targets on single-node deployments.

## Prerequisites

- Services running via `docker compose up -d --build`
- k6 installed and available in PATH
- Gateway endpoint reachable at `http://localhost`

## Run load test

```powershell
pwsh tests/perf/run-k6.ps1 -BaseUrl http://localhost -Duration 60s -Vus 40 -Rps 800
```

This command exports summary metrics to `tests/perf/k6-summary.json`.

## Validate SLO

```powershell
pwsh scripts/check-slo.ps1 -SummaryJson tests/perf/k6-summary.json -P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

Exit code:

- `0`: SLO passed
- `2`: SLO failed

## Suggested baseline thresholds (2C2G)

- P95 < 50ms
- P99 < 150ms
- Error rate < 0.1%

Tune RPS and VUs per environment to avoid over-driving non-production hosts.
