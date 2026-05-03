# Failover and Degradation Drill

## Objective

Verify service behavior under dependency stress and ensure critical API paths remain available.

## Drill A: Redis disruption

1. Stop Redis container (compose) or restart Redis deployment (k8s).
2. Call `GET /health/ready` and `POST /api/v1/transform/preview`.
3. Expected:
   - `health/ready` may become degraded.
   - preview still works through MySQL fallback (higher latency acceptable).

## Drill B: MySQL disruption

1. Restart MySQL.
2. Call `GET /health/ready` and `GET /api/v1/rules`.
3. Expected:
   - `health/ready` degraded during restart window.
   - read operations recover automatically after DB resumes.

## Drill C: Backend rolling restart

1. Trigger rollout restart.
2. Keep firing preview requests (k6 or curl loop).
3. Expected:
   - No full outage.
   - Gateway routes traffic to healthy pods/containers.

## Drill commands (compose)

```powershell
docker compose restart redis
docker compose restart mysql
docker compose restart backend
```

## Drill commands (k8s)

```powershell
kubectl rollout restart deploy/redis -n api-control-plane
kubectl rollout restart deploy/mysql -n api-control-plane
kubectl rollout restart deploy/backend -n api-control-plane
```
