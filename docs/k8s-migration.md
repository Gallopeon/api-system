# Kubernetes Migration Guide

## Goal

Migrate from single-node Docker Compose to multi-node Kubernetes while keeping API behavior and control-plane UX stable.

## 1. Build images

```powershell
docker build -t api-control-plane-backend:latest backend
docker build -t api-control-plane-frontend:latest frontend
```

Push to your registry and replace image names in `deploy/k8s/base.yaml`.

## 2. Deploy base resources

```powershell
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -k deploy/k8s
```

## 3. Verify readiness

```powershell
kubectl get pods -n api-control-plane
kubectl get svc -n api-control-plane
kubectl rollout status deploy/backend -n api-control-plane
kubectl rollout status deploy/frontend -n api-control-plane
kubectl rollout status deploy/gateway -n api-control-plane
```

## 4. Smoke checks

- `GET /health/live`
- `GET /health/ready`
- `POST /api/v1/transform/expr-eval`
- Panel create rule + diff + rollback + audit query

## 5. Progressive rollout

Use the rollout script to update backend/frontend image tags with rollout status tracking:

```powershell
pwsh scripts/k8s-rollout.ps1 -Namespace api-control-plane -Service backend -Image your-registry/backend:tag
pwsh scripts/k8s-rollout.ps1 -Namespace api-control-plane -Service frontend -Image your-registry/frontend:tag
```

Optional: enable post-deploy SLO gate and auto rollback when gate fails.

```powershell
pwsh scripts/k8s-rollout.ps1 `
	-Namespace api-control-plane `
	-Service backend `
	-Image your-registry/backend:tag `
	-RunSloGate `
	-BaseUrl http://localhost `
	-Duration 60s -Vus 40 -Rps 800 `
	-P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

## 6. Key migration notes

- Keep sessions stateless in Redis.
- Keep MySQL persistent volume mounted before traffic cutover.
- Keep gateway as the stable ingress endpoint during migration.
- Keep audit and metrics APIs enabled to compare behavior before/after cutover.
