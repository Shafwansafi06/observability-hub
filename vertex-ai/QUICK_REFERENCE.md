# Vertex AI - Quick Reference Card

## 🚀 Quick Start Commands

```bash
# 1. Setup (5 min)
cd vertex-ai/scripts
./01-setup-iam.sh
source .env.vertex-ai

# 2. Deploy Model (5 min)
./02-deploy-model.sh llm-gpt4-turbo v1
export MODEL_ID=$(cat .vertex-ai-model-*.json | jq -r '.model_id')

# 3. Create Endpoint (5 min)
./03-create-endpoint.sh llm-production-endpoint
export ENDPOINT_ID=$(cat .vertex-ai-endpoint-*.json | jq -r '.endpoint_id')

# 4. Deploy to Endpoint (10 min)
gcloud ai endpoints deploy-model $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --model=$MODEL_ID \
  --machine-type=n1-highmem-8 \
  --min-replica-count=2 \
  --max-replica-count=20

# 5. Test (2 min)
./06-test-prediction.sh $ENDPOINT_ID
```

## 📦 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `scripts/01-setup-iam.sh` | IAM & SA setup | 150 |
| `scripts/02-deploy-model.sh` | Model upload | 120 |
| `scripts/03-create-endpoint.sh` | Endpoint creation | 180 |
| `scripts/06-test-prediction.sh` | Integration tests | 110 |
| `python/vertex_ai_client.py` | Python SDK | 450 |
| `nextjs/lib/vertex-ai-client.ts` | TypeScript client | 350 |
| `nextjs/api/predict/route.ts` | API route | 130 |
| `config/monitoring.yaml` | Monitoring setup | 600 |

## 🎯 Architecture Quick View

```
Client → Next.js API → Circuit Breaker → Rate Limiter 
  → Vertex AI Endpoint (90% Prod / 10% Canary)
    → Autoscaling Replicas (2-20)
      → Model Container (n1-highmem-8)
        → Response
  → Cloud Monitoring + Datadog
```

## 🔧 Common Operations

### Make a Prediction

```bash
gcloud ai endpoints predict $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --json-request=<(echo '{
    "instances": [{"prompt": "Hello", "max_tokens": 50}]
  }')
```

### Check Endpoint Status

```bash
gcloud ai endpoints describe $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --format="get(deployedModels[0].state)"
```

### Update Traffic Split

```bash
gcloud ai endpoints update-traffic-split $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --traffic-split=OLD_ID=50,NEW_ID=50
```

### Scale Replicas

```bash
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --min-replica-count=3 \
  --max-replica-count=30
```

### View Logs

```bash
gcloud logging read \
  'resource.type="aiplatform.googleapis.com/Endpoint"
   resource.labels.endpoint_id="'$ENDPOINT_ID'"' \
  --limit=50 \
  --format=json
```

### Check Metrics

```bash
gcloud monitoring time-series list \
  --filter='metric.type="aiplatform.googleapis.com/prediction/online/prediction_count"
           resource.labels.endpoint_id="'$ENDPOINT_ID'"'
```

## 🔥 Emergency Commands

### Circuit Breaker is OPEN

```typescript
// Restart Next.js server to reset circuit breaker
pm2 restart app
```

### All Replicas Down

```bash
# Force scale up
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --min-replica-count=5

# Or failover to backup region
export VERTEX_AI_REGION=europe-west1
# Redirect traffic via DNS/Load Balancer
```

### High Latency (P95 > 1000ms)

```bash
# 1. Check replica count
gcloud ai endpoints describe $ENDPOINT_ID --region=$VERTEX_AI_REGION

# 2. Scale up immediately
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --min-replica-count=10

# 3. Upgrade machine type (if needed)
# Deploy new version with n1-highmem-16
```

### Error Rate > 5%

```bash
# 1. Check logs for errors
gcloud logging read \
  'resource.labels.endpoint_id="'$ENDPOINT_ID'"
   severity>=ERROR' \
  --limit=100

# 2. Rollback to previous model
gcloud ai endpoints update-traffic-split $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --traffic-split=OLD_MODEL_ID=100,NEW_MODEL_ID=0
```

## 💰 Cost Queries

```bash
# Check current costs
gcloud billing accounts get-iam-policy $BILLING_ACCOUNT_ID

# View resource usage
gcloud ai endpoints list \
  --region=$VERTEX_AI_REGION \
  --format="table(name,deployedModels[0].automaticResources.minReplicaCount,deployedModels[0].automaticResources.maxReplicaCount)"

# Enable cost tracking
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --update-labels=cost-center=ml,environment=prod
```

## 📊 Key Metrics Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| **Latency P95** | < 500ms | 500-1000ms | > 1000ms |
| **Error Rate** | < 0.1% | 0.1-1% | > 1% |
| **Availability** | > 99.9% | 99-99.9% | < 99% |
| **CPU Utilization** | 50-70% | 70-90% | > 90% |
| **Replica Count** | 2-10 | 10-15 | < 2 or > 15 |
| **QPS** | 50-200 | 200-400 | > 400 |

## 🔐 Security Checklist

- [ ] Service account key not in git
- [ ] IAM roles follow least privilege
- [ ] VPC Service Controls enabled
- [ ] TLS 1.3 configured
- [ ] Audit logging enabled
- [ ] Secrets in Secret Manager
- [ ] Network policies configured

## 📱 Monitoring Links

```bash
# Cloud Console
echo "https://console.cloud.google.com/vertex-ai/endpoints/$ENDPOINT_ID?project=$GOOGLE_CLOUD_PROJECT"

# Monitoring Dashboard
echo "https://console.cloud.google.com/monitoring/dashboards?project=$GOOGLE_CLOUD_PROJECT"

# Logs Explorer
echo "https://console.cloud.google.com/logs/query?project=$GOOGLE_CLOUD_PROJECT"

# Billing
echo "https://console.cloud.google.com/billing?project=$GOOGLE_CLOUD_PROJECT"
```

## 🎯 Python One-Liner

```python
# Quick prediction
from google.cloud import aiplatform; endpoint = aiplatform.Endpoint("projects/PROJECT/locations/REGION/endpoints/ENDPOINT_ID"); print(endpoint.predict([{"prompt": "Hello"}]))
```

## 🌐 Next.js API Test

```bash
# Test prediction endpoint
curl -X POST http://localhost:3000/api/vertex-ai/predict \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain AI", "max_tokens": 100}' \
  | jq .
```

## 📞 Support Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| **P1 - Critical** | PagerDuty + on-call | < 15 min |
| **P2 - High** | Slack #ml-infra | < 1 hour |
| **P3 - Normal** | Email team@example.com | < 4 hours |
| **Questions** | Slack #ml-help | < 24 hours |

## 🚨 Incident Response

1. **Detect**: Alerts fire → PagerDuty notification
2. **Assess**: Check dashboard, logs, metrics
3. **Mitigate**: Rollback / Scale up / Failover
4. **Resolve**: Fix root cause
5. **Document**: Post-mortem in Confluence

## 📚 Documentation

- **Full Guide**: `DEPLOYMENT_GUIDE.md`
- **Architecture**: `ARCHITECTURE.md`
- **API Docs**: `README.md`
- **Troubleshooting**: Check logs first!

---

**🎯 Remember**: Test in staging first. Monitor closely. Rollback quickly if needed.

**💡 Pro Tip**: Bookmark this file for quick reference during incidents!
