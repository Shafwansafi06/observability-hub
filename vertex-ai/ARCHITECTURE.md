# Vertex AI Online Inference Architecture

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│                    (Web, Mobile, Internal Services)                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloud Load Balancer                           │
│                     (Global, SSL Termination)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
         ┌──────────────────┐      ┌──────────────────┐
         │   Region: US     │      │   Region: EU     │
         │  (Primary)       │      │  (Failover)      │
         └────────┬─────────┘      └────────┬─────────┘
                  │                          │
                  ▼                          ▼
    ┌─────────────────────────┐  ┌─────────────────────────┐
    │  Next.js API Routes     │  │  Next.js API Routes     │
    │  - Rate Limiting        │  │  - Rate Limiting        │
    │  - Auth Validation      │  │  - Auth Validation      │
    │  - Circuit Breaker      │  │  - Circuit Breaker      │
    └───────────┬─────────────┘  └───────────┬─────────────┘
                │                            │
                │                            │
                ▼                            ▼
    ┌─────────────────────────┐  ┌─────────────────────────┐
    │  Vertex AI Endpoints    │  │  Vertex AI Endpoints    │
    │  ┌───────────────────┐  │  │  ┌───────────────────┐  │
    │  │ Production (90%)  │  │  │  │ Production (90%)  │  │
    │  │ - GPT-4 Model     │  │  │  │ - GPT-4 Model     │  │
    │  │ - n1-highmem-8    │  │  │  │ - n1-highmem-8    │  │
    │  │ - Min: 2 replicas │  │  │  │ - Min: 2 replicas │  │
    │  │ - Max: 20         │  │  │  │ - Max: 20         │  │
    │  └───────────────────┘  │  │  └───────────────────┘  │
    │                         │  │                         │
    │  ┌───────────────────┐  │  │  ┌───────────────────┐  │
    │  │ Canary (10%)      │  │  │  │ Canary (10%)      │  │
    │  │ - GPT-4-Turbo     │  │  │  │ - GPT-4-Turbo     │  │
    │  │ - n1-highmem-4    │  │  │  │ - n1-highmem-4    │  │
    │  │ - Min: 1 replica  │  │  │  │ - Min: 1 replica  │  │
    │  │ - Max: 5          │  │  │  │ - Max: 5          │  │
    │  └───────────────────┘  │  │  └───────────────────┘  │
    └───────────┬─────────────┘  └───────────┬─────────────┘
                │                            │
                ▼                            ▼
    ┌─────────────────────────┐  ┌─────────────────────────┐
    │  Cloud Logging          │  │  Cloud Logging          │
    │  Cloud Monitoring       │  │  Cloud Monitoring       │
    │  Cloud Trace            │  │  Cloud Trace            │
    └─────────────────────────┘  └─────────────────────────┘
                │                            │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │      Datadog            │
                │  - Unified Metrics      │
                │  - Logs Aggregation     │
                │  - APM Traces           │
                │  - Alerts & Incidents   │
                └─────────────────────────┘
```

## 2. Online Prediction Flow

```
User Request
    │
    ├─► [1] API Gateway (Next.js)
    │       │
    │       ├─► Rate Limiting Check
    │       ├─► JWT Validation
    │       ├─► Circuit Breaker Status
    │       │
    │       └─► [2] Vertex AI SDK Call
    │               │
    │               ├─► Region Selection (Primary/Failover)
    │               ├─► Endpoint Selection (Traffic Split)
    │               │
    │               └─► [3] Vertex AI Endpoint
    │                       │
    │                       ├─► Load Balancer (Internal)
    │                       ├─► Model Replica Selection
    │                       │
    │                       └─► [4] Model Container
    │                               │
    │                               ├─► Pre-processing
    │                               ├─► Inference (GPU/CPU)
    │                               ├─► Post-processing
    │                               │
    │                               └─► [5] Response
    │                                       │
    │                                       ├─► Streaming (SSE)
    │                                       └─► Batch Response
    │
    └─► [6] Logging & Monitoring
            │
            ├─► Cloud Logging (Structured)
            ├─► Cloud Monitoring (Metrics)
            ├─► Cloud Trace (Distributed Tracing)
            └─► Datadog (Unified Observability)
```

## 3. Blue-Green Deployment Strategy

```
┌────────────────────────────────────────────────────────────┐
│                    Deployment Phases                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Initial State                                    │
│  ┌──────────────────┐                                      │
│  │  Blue (v1.0)     │  ◄─── 100% Traffic                   │
│  │  Production      │                                      │
│  └──────────────────┘                                      │
│                                                             │
│  Phase 2: Deploy Green                                     │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Blue (v1.0)     │  ◄─── │ 100% Traffic     │          │
│  │  Production      │       └──────────────────┘          │
│  └──────────────────┘                                      │
│  ┌──────────────────┐                                      │
│  │  Green (v1.1)    │  ◄─── Deployed, 0% traffic           │
│  │  Staging         │       (Health checks running)        │
│  └──────────────────┘                                      │
│                                                             │
│  Phase 3: Canary (10% Traffic)                             │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Blue (v1.0)     │  ◄─── │ 90% Traffic      │          │
│  └──────────────────┘       └──────────────────┘          │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Green (v1.1)    │  ◄─── │ 10% Traffic      │          │
│  └──────────────────┘       └──────────────────┘          │
│                                                             │
│  Phase 4: Ramp Up (50% Traffic)                            │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Blue (v1.0)     │  ◄─── │ 50% Traffic      │          │
│  └──────────────────┘       └──────────────────┘          │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Green (v1.1)    │  ◄─── │ 50% Traffic      │          │
│  └──────────────────┘       └──────────────────┘          │
│                                                             │
│  Phase 5: Full Cutover                                     │
│  ┌──────────────────┐                                      │
│  │  Blue (v1.0)     │  ◄─── 0% Traffic (Standby)           │
│  │  (Rollback Ready)│                                      │
│  └──────────────────┘                                      │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Green (v1.1)    │  ◄─── │ 100% Traffic     │          │
│  │  Production      │       └──────────────────┘          │
│  └──────────────────┘                                      │
│                                                             │
│  Phase 6: Cleanup (After 24h Monitoring)                   │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │  Green (v1.1)    │  ◄─── │ 100% Traffic     │          │
│  │  Production      │       └──────────────────┘          │
│  └──────────────────┘                                      │
│                                                             │
│  Blue (v1.0) Decommissioned                                │
└────────────────────────────────────────────────────────────┘
```

## 4. Autoscaling Strategy

### Scaling Triggers

| Metric | Scale Up Threshold | Scale Down Threshold | Cooldown |
|--------|-------------------|---------------------|----------|
| **CPU Utilization** | > 70% for 2 min | < 30% for 5 min | 3 min |
| **Memory Usage** | > 80% for 2 min | < 40% for 5 min | 3 min |
| **Request Latency (P95)** | > 500ms for 1 min | < 200ms for 5 min | 2 min |
| **QPS (Queries/sec)** | > 100 QPS | < 20 QPS | 5 min |
| **Queue Depth** | > 50 requests | < 10 requests | 2 min |

### Scaling Configuration

```yaml
Production Endpoint:
  min_replicas: 2
  max_replicas: 20
  scale_up_step: 2 replicas
  scale_down_step: 1 replica
  machine_type: n1-highmem-8 (8 vCPU, 52GB RAM)
  accelerator: NVIDIA_TESLA_T4 (1 GPU) [optional]

Canary Endpoint:
  min_replicas: 1
  max_replicas: 5
  scale_up_step: 1 replica
  scale_down_step: 1 replica
  machine_type: n1-highmem-4 (4 vCPU, 26GB RAM)
```

## 5. Model Upload Workflow

```
Developer → GitHub → CI/CD Pipeline → Vertex AI Model Registry
    │
    └─► [1] Model Training
            │
            ├─► Train on Vertex AI Training
            ├─► Validate metrics (accuracy, latency)
            ├─► Export model artifacts
            │
            └─► [2] Model Packaging
                    │
                    ├─► Build Docker image
                    ├─► Include dependencies
                    ├─► Add health check endpoint
                    │
                    └─► [3] Push to Container Registry
                            │
                            └─► [4] Register in Vertex AI
                                    │
                                    ├─► Create Model version
                                    ├─► Add metadata (metrics, labels)
                                    │
                                    └─► [5] Deploy to Endpoint
                                            │
                                            ├─► Canary deployment (10%)
                                            ├─► Monitor for 1 hour
                                            ├─► Gradual ramp-up (50%)
                                            └─► Full deployment (100%)
```

## 6. Batch Prediction Setup

```
Data Source → Cloud Storage → Vertex AI Batch Prediction → Results Storage
    │
    └─► [1] Input Preparation
            │
            ├─► Format: JSONL, CSV, TFRecord
            ├─► Location: gs://bucket/input/
            │
            └─► [2] Submit Batch Job
                    │
                    ├─► Job Configuration
                    │   ├─► Model: projects/.../models/...
                    │   ├─► Machine: n1-standard-16
                    │   ├─► Replicas: 10
                    │   └─► Max runtime: 12 hours
                    │
                    └─► [3] Processing
                            │
                            ├─► Automatic sharding
                            ├─► Parallel processing
                            ├─► Retry failed instances
                            │
                            └─► [4] Output Collection
                                    │
                                    ├─► Results: gs://bucket/output/
                                    ├─► Errors: gs://bucket/errors/
                                    └─► Logs: Cloud Logging
```

## 7. Cost Optimization

### Machine Type Comparison

| Machine Type | vCPU | Memory | GPU | $/hour | Use Case |
|--------------|------|--------|-----|--------|----------|
| **n1-standard-4** | 4 | 15GB | - | $0.19 | Light workloads |
| **n1-highmem-4** | 4 | 26GB | - | $0.24 | Memory-intensive |
| **n1-highmem-8** | 8 | 52GB | - | $0.47 | Production (Recommended) |
| **n1-highmem-16** | 16 | 104GB | - | $0.95 | High-memory models |
| **a2-highgpu-1g** | 12 | 85GB | 1xA100 | $3.67 | GPU inference |
| **g2-standard-4** | 4 | 16GB | 1xL4 | $1.35 | GPU (Cost-effective) |

### Cost Optimization Strategies

1. **Right-sizing**: Start with n1-highmem-4, scale to n1-highmem-8 only if needed
2. **Autoscaling**: Aggressive scale-down during off-peak hours
3. **Preemptible instances**: Use for batch predictions (60-80% cost savings)
4. **Regional selection**: Use us-central1 (cheapest region)
5. **Committed Use Discounts**: 1-year commitment = 37% discount, 3-year = 55%
6. **Batch inference**: Use batch predictions for non-real-time workloads

### Monthly Cost Estimate (Production)

```
Production Endpoint (2-20 replicas, n1-highmem-8):
  Baseline (2 replicas × 730 hours × $0.47): $686/month
  Peak (20 replicas × 2 hours/day × 30 days × $0.47): $564/month
  Average: ~$1,250/month

Canary Endpoint (1-5 replicas, n1-highmem-4):
  Baseline (1 replica × 730 hours × $0.24): $175/month
  Average: ~$250/month

Total Infrastructure: ~$1,500/month (before CUD)
With 1-year CUD: ~$945/month (37% savings)
```

## 8. Health Monitoring & Alerts

### Key Metrics

| Metric | Threshold | Alert Priority |
|--------|-----------|----------------|
| **Endpoint Availability** | < 99.9% | P1 - Critical |
| **Request Latency (P95)** | > 1000ms | P2 - High |
| **Error Rate** | > 1% | P1 - Critical |
| **Model Accuracy Drift** | > 5% deviation | P2 - High |
| **Replica Health** | < 2 healthy | P1 - Critical |
| **GPU Utilization** | > 90% or < 20% | P3 - Warning |
| **Memory Usage** | > 90% | P2 - High |
| **Queue Depth** | > 100 requests | P2 - High |

## 9. Multi-Region Failover

```
Primary Region: us-central1
Failover Region: europe-west1

Failover Triggers:
1. Region availability < 95% for 5 minutes
2. Latency > 2000ms for 3 minutes
3. Error rate > 5% for 2 minutes

Failover Strategy:
1. DNS-based routing (Cloud DNS)
2. Health check endpoint: /health
3. Automatic traffic shift: 100% → Failover region
4. Alert notifications: PagerDuty, Slack
5. Rollback: Manual trigger after region recovery
```

## 10. Security & IAM

### Network Security
- **VPC Service Controls**: Restrict data exfiltration
- **Private IP**: Endpoints accessible only within VPC
- **Cloud Armor**: DDoS protection
- **TLS 1.3**: Encryption in transit

### IAM Roles
- `roles/aiplatform.user`: Deploy models, create endpoints
- `roles/aiplatform.viewer`: Read-only access
- `roles/aiplatform.admin`: Full administrative access
- Custom role: `vertex-ai-predictor` (predict-only access)

This architecture provides enterprise-grade reliability, scalability, and observability for production LLM inference workloads.
