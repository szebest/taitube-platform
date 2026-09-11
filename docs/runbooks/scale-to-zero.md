# Runbook: Scale-to-Zero Broken (Kubernetes Only)

## 1. Overview & Architecture
In Kubernetes deployments (SDD §13.2, Ticket 26), worker Deployments autoscale based on queue depth via KEDA `ScaledObject` resources.
When jobs are waiting in BullMQ (`bullmq_queue_jobs{state="waiting"} > 0`), KEDA is expected to activate the deployment from 0 to at least 1 replica within 10–30 seconds.

If jobs are waiting in the queue but the deployment status shows 0 replicas for > 3 minutes, the `ScaleToZeroBroken` alert fires.

> **Note**: This alert depends on `kube_deployment_status_replicas` (from `kube-state-metrics`) and is **Kubernetes-only**. It will not fire in local Docker Compose environments.

---

## 2. Trigger Alert
- **Alert Name**: `ScaleToZeroBroken`
- **Expression**: `bullmq_queue_jobs{state="waiting"} > 0 and kube_deployment_status_replicas == 0`
- **Severity**: `critical`
- **Duration**: `3m`

---

## 3. Dashboards to Open
- **Queues Dashboard**: `/d/queues` — Check "Replicas vs Outstanding Backlog (Autoscaling Proof)" panel.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Check KEDA Operator Status
Verify that KEDA operator and metrics server pods are running:
```bash
kubectl get pods -n keda
kubectl logs -n keda deployment/keda-operator --tail=50
```

### Step 2: Check ScaledObject Status
Inspect the `ScaledObject` status and events:
```bash
kubectl get scaledobjects
kubectl describe scaledobject worker-<stage>
```
Look for errors in `Status.Conditions`:
- `Ready: False`
- `Active: False`
- Prometheus server connection failures (e.g. `serverAddress` unreachable from KEDA pod)
- Redis trigger connection / authentication errors

### Step 3: Check Prometheus Trigger Query
Verify the Prometheus query used by KEDA returns data:
```bash
# Forward Prometheus port if needed
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090
```
Query:
```promql
sum(bullmq_queue_jobs{queue="<stage>", state=~"waiting|prioritized|active"})
```

### Step 4: Emergency Manual Scale-Out
If KEDA is failing, temporarily scale the deployment manually while investigating:
```bash
kubectl scale deployment worker-<stage> --replicas=2
```

---

## 5. Verification
1. Ensure `kube_deployment_status_replicas{deployment=~"worker-.*"} > 0`.
2. Confirm the waiting backlog drains in the queues dashboard.
3. Verify `ScaleToZeroBroken` alert resolves.
