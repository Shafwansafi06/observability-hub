# Vertex AI - Complete Deployment Guide

## 🎯 Executive Summary

This guide walks you through deploying a **production-grade Vertex AI online inference system** in 30 minutes. The infrastructure supports:

- **Scalability**: 2-20 auto-scaling replicas handling 10-600 QPS
- **Reliability**: 99.9% SLA with multi-region failover
- **Cost Efficiency**: ~$845/month with committed use discounts
- **Security**: VPC-SC, IAM, TLS 1.3 encryption
- **Observability**: Full integration with Cloud Monitoring + Datadog

---

## 📋 Prerequisites

### Required Tools

```bash
# Check installations
gcloud --version  # >= 400.0.0
python3 --version # >= 3.9
node --version    # >= 18.0.0
jq --version      # For JSON parsing
```

### Install Missing Tools

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Python dependencies
pip install google-cloud-aiplatform google-cloud-storage

# Node.js (if using Next.js integration)
npm install google-auth-library
```

### Google Cloud Setup

```bash
# Authenticate
gcloud auth login
gcloud auth application-default login

# Set project
export GOOGLE_CLOUD_PROJECT="your-project-id"
export VERTEX_AI_REGION="us-central1"

gcloud config set project $GOOGLE_CLOUD_PROJECT
gcloud config set ai-platform/region $VERTEX_AI_REGION
```

---

## 🚀 Phase 1: Infrastructure Setup (10 minutes)

### Step 1.1: Enable APIs & Create Service Account

```bash
cd vertex-ai/scripts
chmod +x *.sh

# Run IAM setup
./01-setup-iam.sh
```

**Expected Output:**
```
[INFO] Enabling required Google Cloud APIs...
[INFO] Creating service account: vertex-ai-predictor
[INFO] Granting IAM roles to service account...
[INFO] Creating custom prediction-only role...
[INFO] Service account key created: vertex-ai-service-account-key.json
✅ Vertex AI IAM Setup Complete!
```

**What was created:**
- Service account: `vertex-ai-predictor@PROJECT_ID.iam.gserviceaccount.com`
- IAM roles: `aiplatform.user`, `storage.objectViewer`, `logging.logWriter`
- Custom role: `vertexAIPredictor` (prediction-only)
- Storage bucket: `gs://PROJECT_ID-vertex-ai-models`
- Service account key: `vertex-ai-service-account-key.json`

### Step 1.2: Secure Credentials

```bash
# Move key to secure location
mv vertex-ai-service-account-key.json ~/.gcloud/

# Update .env file
cat >> .env <<EOF
# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
VERTEX_AI_REGION=$VERTEX_AI_REGION
GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcloud/vertex-ai-service-account-key.json"
EOF

# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo "*.json" >> .gitignore
```

⚠️ **CRITICAL**: Never commit service account keys to version control!

---

## 🧠 Phase 2: Model Deployment (10 minutes)

### Step 2.1: Prepare Model Container

For this guide, we'll use a sample LLM container. In production, replace with your actual model.

```bash
# Option A: Use pre-built container (for testing)
export CONTAINER_IMAGE="gcr.io/cloud-aiplatform/prediction/tf2-cpu.2-8:latest"

# Option B: Build your own (production)
cd your-model-directory
docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT/vertex-ai-llm:v1 .
docker push gcr.io/$GOOGLE_CLOUD_PROJECT/vertex-ai-llm:v1
export CONTAINER_IMAGE="gcr.io/$GOOGLE_CLOUD_PROJECT/vertex-ai-llm:v1"
```

**Your container must expose:**
- Health check: `GET /health` → Returns 200 OK
- Prediction: `POST /predict` → Accepts JSON, returns predictions

### Step 2.2: Upload Model to Registry

```bash
# Create model artifacts directory
mkdir -p /tmp/model-artifacts
echo '{"model": "gpt4-turbo", "version": "v1"}' > /tmp/model-artifacts/config.json

# Upload artifacts to GCS
gsutil -m cp -r /tmp/model-artifacts/* \
  gs://$GOOGLE_CLOUD_PROJECT-vertex-ai-models/gpt4-turbo/v1/

# Deploy model to Vertex AI
./02-deploy-model.sh gpt4-turbo v1 \
  $CONTAINER_IMAGE \
  gs://$GOOGLE_CLOUD_PROJECT-vertex-ai-models/gpt4-turbo/v1
```

**Expected Output:**
```
[INFO] Uploading model to Vertex AI Model Registry...
✅ Model uploaded successfully!
Model ID: 1234567890
Model Resource Name: projects/PROJECT_ID/locations/us-central1/models/1234567890
```

**Save the Model ID:**
```bash
export MODEL_ID=$(cat .vertex-ai-model-gpt4-turbo-v1.json | jq -r '.model_id')
echo "MODEL_ID=$MODEL_ID" >> .env
```

---

## 🌐 Phase 3: Endpoint Creation & Deployment (10 minutes)

### Step 3.1: Create Production Endpoint

```bash
./03-create-endpoint.sh llm-production-endpoint
```

**Expected Output:**
```
[INFO] Creating new endpoint: llm-production-endpoint
✅ Endpoint created successfully!
Endpoint ID: 9876543210
Prediction URL: https://us-central1-aiplatform.googleapis.com/v1/projects/.../endpoints/9876543210:predict
```

**Save the Endpoint ID:**
```bash
export ENDPOINT_ID=$(cat .vertex-ai-endpoint-llm-production-endpoint.json | jq -r '.endpoint_id')
echo "ENDPOINT_ID=$ENDPOINT_ID" >> .env
echo "VERTEX_AI_ENDPOINT_ID=$ENDPOINT_ID" >> .env
```

### Step 3.2: Deploy Model to Endpoint with Autoscaling

```bash
# Production deployment with autoscaling
gcloud ai endpoints deploy-model $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --model=$MODEL_ID \
  --display-name="gpt4-turbo-prod" \
  --machine-type=n1-highmem-8 \
  --min-replica-count=2 \
  --max-replica-count=20 \
  --traffic-split=0=100 \
  --enable-access-logging \
  --enable-container-logging
```

This will take 5-10 minutes. You'll see:
```
Deploying model... (this may take a few minutes)
Deployed model: 1234567890
```

**Verify Deployment:**
```bash
gcloud ai endpoints describe $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --format="yaml"
```

Look for:
```yaml
deployedModels:
- id: '1234567890'
  state: DEPLOYED
  modelVersionId: '1'
```

---

## 🧪 Phase 4: Testing & Verification (5 minutes)

### Step 4.1: Run Integration Tests

```bash
./06-test-prediction.sh $ENDPOINT_ID
```

**Expected Output:**
```
[INFO] Test 1: Simple text generation
✅ Test 1 passed
{
  "text": "Machine learning is a method of data analysis..."
}

[INFO] Test 2: Batch predictions
✅ Test 2 passed
Received 3 predictions

[INFO] Test 3: Load test (10 concurrent requests)
Load test results: 10/10 requests succeeded
✅ Test 3 passed (100% success rate)

Testing Complete!
```

### Step 4.2: Manual Prediction Test

```bash
# Create test request
cat > /tmp/test-request.json <<EOF
{
  "instances": [
    {
      "prompt": "Explain Vertex AI in one sentence.",
      "max_tokens": 50,
      "temperature": 0.7
    }
  ]
}
EOF

# Make prediction
gcloud ai endpoints predict $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --json-request=/tmp/test-request.json
```

**Expected Response:**
```json
{
  "predictions": [
    {
      "text": "Vertex AI is Google Cloud's unified ML platform...",
      "confidence": 0.95
    }
  ],
  "deployedModelId": "1234567890",
  "model": "projects/.../models/1234567890"
}
```

---

## 📊 Phase 5: Monitoring Setup (5 minutes)

### Step 5.1: Create Monitoring Dashboard

```bash
# Import pre-configured dashboard
gcloud monitoring dashboards create \
  --config-from-file=vertex-ai/config/monitoring.yaml
```

**View Dashboard:**
https://console.cloud.google.com/monitoring/dashboards?project=$GOOGLE_CLOUD_PROJECT

### Step 5.2: Configure Alert Policies

```bash
# Create Slack notification channel
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

gcloud alpha monitoring channels create \
  --display-name="Slack - ML Team" \
  --type=slack \
  --channel-labels=url=$SLACK_WEBHOOK

# Get channel ID
CHANNEL_ID=$(gcloud alpha monitoring channels list \
  --filter="displayName='Slack - ML Team'" \
  --format="value(name)")

# Create high latency alert
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Vertex AI - High Latency" \
  --condition-display-name="P95 Latency > 1000ms" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=120s \
  --condition-filter='resource.type="aiplatform.googleapis.com/Endpoint" AND metric.type="aiplatform.googleapis.com/prediction/online/prediction_latencies"'
```

### Step 5.3: Set Up Uptime Checks

```bash
gcloud monitoring uptime create \
  --display-name="Vertex AI Endpoint Health" \
  --resource-type=uptime-url \
  --resource-host="$VERTEX_AI_REGION-aiplatform.googleapis.com" \
  --resource-path="/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$VERTEX_AI_REGION/endpoints/$ENDPOINT_ID" \
  --period=60 \
  --timeout=10s
```

---

## 🔄 Phase 6: Blue-Green Deployment (Optional)

### Deploy Canary Version

```bash
# Upload new model version
./02-deploy-model.sh gpt4-turbo v2 \
  gcr.io/$GOOGLE_CLOUD_PROJECT/vertex-ai-llm:v2 \
  gs://$GOOGLE_CLOUD_PROJECT-vertex-ai-models/gpt4-turbo/v2

NEW_MODEL_ID=$(cat .vertex-ai-model-gpt4-turbo-v2.json | jq -r '.model_id')

# Deploy with 10% traffic (canary)
gcloud ai endpoints deploy-model $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --model=$NEW_MODEL_ID \
  --display-name="gpt4-turbo-canary" \
  --machine-type=n1-highmem-4 \
  --min-replica-count=1 \
  --max-replica-count=5 \
  --traffic-split=0=90,1=10  # 90% old, 10% new
```

### Monitor Canary for 1 Hour

```bash
# Check error rates
gcloud logging read \
  'resource.type="aiplatform.googleapis.com/Endpoint"
   resource.labels.endpoint_id="'$ENDPOINT_ID'"
   severity>=ERROR' \
  --limit=50 \
  --format=json

# Check latency
gcloud monitoring time-series list \
  --filter='metric.type="aiplatform.googleapis.com/prediction/online/prediction_latencies"
           resource.labels.endpoint_id="'$ENDPOINT_ID'"' \
  --start-time=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
```

### Gradual Ramp-Up

```bash
# If canary looks good, ramp to 50%
gcloud ai endpoints update-traffic-split $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --traffic-split=0=50,1=50

# Monitor for 30 minutes, then go to 100%
gcloud ai endpoints update-traffic-split $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --traffic-split=0=0,1=100

# After 24 hours, undeploy old version
gcloud ai endpoints undeploy-model $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --deployed-model-id=$OLD_DEPLOYED_MODEL_ID
```

---

## 🔐 Phase 7: Security Hardening (10 minutes)

### Enable VPC Service Controls

```bash
# Create access policy
gcloud access-context-manager policies create \
  --title="Vertex AI Access Policy"

POLICY_ID=$(gcloud access-context-manager policies list \
  --format="value(name)")

# Create service perimeter
gcloud access-context-manager perimeters create vertex_ai_perimeter \
  --title="Vertex AI Perimeter" \
  --resources=projects/$GOOGLE_CLOUD_PROJECT \
  --restricted-services=aiplatform.googleapis.com \
  --policy=$POLICY_ID
```

### Configure Private Endpoint (Optional)

```bash
# Create VPC network
gcloud compute networks create vertex-ai-vpc \
  --subnet-mode=custom

# Create subnet
gcloud compute networks subnets create vertex-ai-subnet \
  --network=vertex-ai-vpc \
  --region=$VERTEX_AI_REGION \
  --range=10.0.0.0/24 \
  --enable-private-ip-google-access

# Update endpoint to use private IP
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --network=projects/$GOOGLE_CLOUD_PROJECT/global/networks/vertex-ai-vpc
```

---

## 💻 Phase 8: Application Integration

### Python Client

```python
# Install dependencies
pip install google-cloud-aiplatform

# Use the client
from vertex_ai_client import VertexAIClient
import os

client = VertexAIClient(
    project_id=os.getenv("GOOGLE_CLOUD_PROJECT"),
    region=os.getenv("VERTEX_AI_REGION")
)

from google.cloud import aiplatform
endpoint = aiplatform.Endpoint(
    f"projects/{os.getenv('GOOGLE_CLOUD_PROJECT')}/locations/{os.getenv('VERTEX_AI_REGION')}/endpoints/{os.getenv('ENDPOINT_ID')}"
)

predictions = client.predict_with_retry(
    endpoint=endpoint,
    instances=[{"prompt": "Hello, world!"}]
)

print(predictions)
```

### Next.js API Route

```typescript
// app/api/predict/route.ts
import { getVertexAIClient } from '@/vertex-ai/nextjs/lib/vertex-ai-client';

export async function POST(request: Request) {
  const { prompt } = await request.json();
  
  const client = getVertexAIClient();
  const prediction = await client.predictWithRetry([{
    prompt,
    max_tokens: 1000
  }]);
  
  return Response.json({ prediction });
}
```

### Test from Frontend

```bash
curl -X POST http://localhost:3000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain Vertex AI"}'
```

---

## ✅ Post-Deployment Checklist

- [ ] All tests passing (Step 4.1)
- [ ] Monitoring dashboard created (Step 5.1)
- [ ] Alert policies configured (Step 5.2)
- [ ] Uptime checks enabled (Step 5.3)
- [ ] Service account key secured (Step 1.2)
- [ ] VPC Service Controls enabled (Step 7)
- [ ] Application integration tested (Step 8)
- [ ] Incident response runbook documented
- [ ] Team trained on deployment process
- [ ] Backup region configured (multi-region)
- [ ] Cost alerts set up
- [ ] Load testing completed (100+ QPS)

---

## 🚨 Troubleshooting

### Deployment Stuck at "Deploying..."

```bash
# Check deployment status
gcloud ai endpoints describe $ENDPOINT_ID --region=$VERTEX_AI_REGION

# Check logs
gcloud logging read \
  'resource.type="aiplatform.googleapis.com/Endpoint"
   resource.labels.endpoint_id="'$ENDPOINT_ID'"
   severity>=WARNING' \
  --limit=50
```

### Predictions Failing with 503

```bash
# Check replica health
gcloud ai endpoints describe $ENDPOINT_ID --region=$VERTEX_AI_REGION \
  --format="get(deployedModels[0].privateEndpoints)"

# Scale up min replicas
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --min-replica-count=3
```

### High Costs

```bash
# Check current usage
gcloud billing accounts list

# Enable cost tracking labels
gcloud ai endpoints update $ENDPOINT_ID \
  --region=$VERTEX_AI_REGION \
  --update-labels=cost-center=ml,environment=prod

# Set up budget alerts
gcloud billing budgets create \
  --billing-account=$BILLING_ACCOUNT_ID \
  --display-name="Vertex AI Budget" \
  --budget-amount=1000 \
  --threshold-rule=percent=50,80,100
```

---

## 📈 Next Steps

1. **Optimize Performance**: Run A/B tests on machine types
2. **Cost Optimization**: Enable committed use discounts
3. **Multi-Region**: Deploy to europe-west1 for failover
4. **Advanced Monitoring**: Integrate with Datadog
5. **CI/CD**: Automate deployments with Cloud Build
6. **Model Monitoring**: Set up drift detection
7. **Feature Store**: Integrate with Vertex AI Feature Store

---

## 🎓 Success Criteria

Your deployment is successful when:

✅ Predictions return in < 500ms (P95)
✅ Error rate < 1%
✅ Autoscaling working (2-20 replicas)
✅ All alerts firing correctly
✅ Monitoring dashboard showing metrics
✅ Load test passes (100 QPS for 5 minutes)
✅ Blue-green deployment working
✅ Cost within budget ($1,500/month)

**Congratulations! You now have a production-grade Vertex AI inference system! 🎉**
