# Vertex AI Production Inference Stack

Complete production-ready infrastructure for deploying and managing ML models on Vertex AI.

## Directory Structure

```
vertex-ai/
├── README.md                          # This file
├── scripts/                           # CLI automation scripts
│   ├── 01-setup-project.sh           # Project initialization
│   ├── 02-upload-model.sh            # Upload model to registry
│   ├── 03-create-endpoint.sh         # Create endpoint
│   ├── 04-deploy-model.sh            # Deploy model to endpoint
│   ├── 05-traffic-split.sh           # Blue-green traffic management
│   ├── 06-autoscaling-config.sh      # Configure autoscaling
│   ├── 07-batch-prediction.sh        # Batch inference
│   ├── 08-monitoring-setup.sh        # Monitoring & alerting
│   ├── 09-canary-deployment.sh       # Canary rollout
│   └── 10-rollback.sh                # Emergency rollback
├── python/                            # Python SDK code
│   ├── model_upload.py               # Model registry operations
│   ├── endpoint_manager.py           # Endpoint CRUD
│   ├── prediction_client.py          # Inference client
│   ├── batch_predictor.py            # Batch inference
│   ├── streaming_client.py           # Streaming responses
│   └── monitoring.py                 # Custom metrics
├── nextjs/                            # Next.js integration
│   ├── app/
│   │   └── api/
│   │       ├── predict/
│   │       │   └── route.ts          # Prediction API
│   │       ├── batch/
│   │       │   └── route.ts          # Batch prediction API
│   │       └── stream/
│   │           └── route.ts          # Streaming API
│   ├── lib/
│   │   ├── vertex-client.ts          # Vertex AI client
│   │   ├── rate-limiter.ts           # Rate limiting
│   │   └── circuit-breaker.ts        # Circuit breaker
│   └── actions/
│       └── predict.ts                # Server actions
├── configs/                           # Configuration files
│   ├── iam/
│   │   ├── service-accounts.yaml     # Service account definitions
│   │   └── policies.yaml             # IAM policies
│   ├── vpc/
│   │   ├── vpc-sc.yaml               # VPC Service Controls
│   │   └── firewall.yaml             # Firewall rules
│   ├── monitoring/
│   │   ├── dashboards/               # Cloud Monitoring dashboards
│   │   │   ├── inference-overview.json
│   │   │   └── model-performance.json
│   │   └── alerts/                   # Alert policies
│   │       ├── latency-alerts.yaml
│   │       └── error-alerts.yaml
│   └── deployment/
│       ├── autoscaling.yaml          # Autoscaling policies
│       └── traffic-split.yaml        # Traffic splitting config
├── terraform/                         # IaC for infrastructure
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── endpoints.tf                  # Endpoint resources
│   ├── models.tf                     # Model resources
│   ├── iam.tf                        # IAM configuration
│   ├── monitoring.tf                 # Monitoring resources
│   └── vpc.tf                        # Network configuration
└── docs/                              # Documentation
    ├── deployment-guide.md
    ├── monitoring-guide.md
    ├── troubleshooting.md
    └── cost-optimization.md
```

## Quick Start

### 1. Prerequisites
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install required tools
gcloud components install beta kubectl terraform

# Authenticate
gcloud auth login
gcloud auth application-default login
```

### 2. Project Setup
```bash
# Set project
export PROJECT_ID="your-project-id"
export REGION="us-central1"
gcloud config set project $PROJECT_ID

# Enable APIs
./scripts/01-setup-project.sh
```

### 3. Deploy Model
```bash
# Upload model to registry
./scripts/02-upload-model.sh \
  --model-path=gs://your-bucket/model \
  --model-name=gpt-4o \
  --version=v1.0

# Create endpoint
./scripts/03-create-endpoint.sh \
  --endpoint-name=production-endpoint \
  --region=us-central1

# Deploy model
./scripts/04-deploy-model.sh \
  --model-id=1234567890 \
  --endpoint-id=9876543210 \
  --machine-type=n1-standard-8 \
  --accelerator=NVIDIA_TESLA_T4 \
  --min-replicas=2 \
  --max-replicas=20
```

### 4. Configure Autoscaling
```bash
./scripts/06-autoscaling-config.sh \
  --endpoint-id=9876543210 \
  --target-qps=50 \
  --target-latency=200
```

### 5. Setup Monitoring
```bash
./scripts/08-monitoring-setup.sh \
  --endpoint-id=9876543210
```

## Usage Examples

### Python Client
```python
from vertex_ai.prediction_client import PredictionClient

client = PredictionClient(
    project="your-project",
    location="us-central1",
    endpoint_id="9876543210"
)

# Make prediction
response = client.predict({
    "prompt": "Explain quantum computing",
    "max_tokens": 500,
    "temperature": 0.7
})
print(response["text"])
```

### Next.js API
```typescript
// app/api/predict/route.ts
import { vertexAIClient } from '@/lib/vertex-client'

export async function POST(req: Request) {
  const { prompt } = await req.json()
  
  const prediction = await vertexAIClient.predict({
    endpoint: 'production-endpoint',
    instances: [{ prompt }]
  })
  
  return Response.json(prediction)
}
```

### cURL
```bash
curl -X POST \
  https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/endpoints/${ENDPOINT_ID}:predict \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "prompt": "What is machine learning?",
      "max_tokens": 100
    }]
  }'
```

## Deployment Strategies

### Blue-Green Deployment
```bash
# Deploy green version with 10% traffic
./scripts/05-traffic-split.sh \
  --endpoint-id=9876543210 \
  --blue-model-id=1111111111 \
  --blue-traffic=90 \
  --green-model-id=2222222222 \
  --green-traffic=10

# Monitor for 1 hour, then increase green traffic
./scripts/05-traffic-split.sh \
  --endpoint-id=9876543210 \
  --blue-traffic=50 \
  --green-traffic=50
```

### Canary Deployment
```bash
./scripts/09-canary-deployment.sh \
  --canary-endpoint=canary-endpoint \
  --production-endpoint=production-endpoint \
  --model-id=3333333333 \
  --canary-percentage=5
```

### Emergency Rollback
```bash
./scripts/10-rollback.sh \
  --endpoint-id=9876543210 \
  --previous-model-id=1111111111
```

## Cost Optimization

### Committed Use Discounts
```bash
# Reserve 10 n1-standard-8 machines for 1 year
gcloud compute commitments create vertex-ai-commitment \
  --region=us-central1 \
  --resources=vcpu=80,memory=300 \
  --plan=12-month
```

### Autoscaling to Zero
```yaml
# configs/deployment/autoscaling.yaml
minReplicaCount: 0  # Scale to zero during off-peak
maxReplicaCount: 50
scaleDownDelay: 300s
```

### Batch Predictions
```bash
# Use batch for non-real-time workloads (60-90% cheaper)
./scripts/07-batch-prediction.sh \
  --input-uri=gs://bucket/input.jsonl \
  --output-uri=gs://bucket/output/ \
  --model-id=1234567890
```

## Monitoring & Alerting

### Key Metrics
- **Latency**: p50, p95, p99 (target: < 300ms p95)
- **Throughput**: requests/second (target: > 1000 QPS)
- **Error Rate**: 4xx/5xx errors (target: < 0.1%)
- **Cost**: $/1000 requests (target: < $0.50)

### Dashboards
- Import pre-built dashboards from `configs/monitoring/dashboards/`
- View in Cloud Console: Monitoring > Dashboards

### Alerts
- Configured via `configs/monitoring/alerts/`
- Notifications: Email, Slack, PagerDuty

## Troubleshooting

### High Latency
```bash
# Check endpoint metrics
gcloud ai endpoints describe ${ENDPOINT_ID} \
  --region=us-central1

# Scale up replicas
gcloud ai endpoints update ${ENDPOINT_ID} \
  --region=us-central1 \
  --min-replica-count=10
```

### Model Errors
```bash
# View logs
gcloud logging read "resource.type=aiplatform.googleapis.com/Endpoint AND resource.labels.endpoint_id=${ENDPOINT_ID}" \
  --limit=100 \
  --format=json

# Check model health
python python/endpoint_manager.py health-check --endpoint-id=${ENDPOINT_ID}
```

### Cost Spikes
```bash
# Analyze usage
bq query --use_legacy_sql=false '
SELECT
  timestamp,
  endpoint_id,
  COUNT(*) as requests,
  AVG(latency_ms) as avg_latency
FROM `project.dataset.predictions`
WHERE DATE(timestamp) = CURRENT_DATE()
GROUP BY timestamp, endpoint_id
ORDER BY timestamp DESC
'
```

## Security Best Practices

1. **Service Accounts**: Use dedicated service accounts with minimal permissions
2. **VPC-SC**: Enable VPC Service Controls for production endpoints
3. **Private Endpoints**: Use Private Service Connect for internal traffic
4. **Encryption**: Enable CMEK for data at rest
5. **Audit Logs**: Enable all audit logs and export to BigQuery

## Support

- **Documentation**: See `docs/` directory
- **Issues**: Create GitHub issue
- **Slack**: #vertex-ai-support
- **On-call**: PagerDuty escalation
