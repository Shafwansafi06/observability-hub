# 🧠 ObservAI Hub - LLM Observability Platform

[![Datadog](https://img.shields.io/badge/Datadog-632CA6?style=for-the-badge&logo=datadog&logoColor=white)](https://www.datadoghq.com/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **End-to-end LLM observability with deep telemetry, anomaly detection, and automated incident management. Built for the next generation of AI engineers.**

---

## 🎯 Project Overview

ObservAI is a comprehensive observability platform specifically designed for LLM-powered applications. It combines infrastructure, application, and AI-level telemetry to provide unprecedented visibility into your AI systems.

### Key Features

- 🔍 **LLM-Level Telemetry**: Track tokens, latencies, confidence scores, embeddings, and prompt-response pairs
- 🛡️ **AI Safety Detection**: Detect hallucinations, prompt injections, data leakage, and other AI-specific failures
- ⚡ **Sub-second Alerting**: Get notified within seconds of anomalies with context-rich incident packages
- 📊 **Advanced Analytics**: Datadog dashboards with infrastructure, app, and model metrics in one view
- 🤖 **Automated Incidents**: Auto-create Datadog incidents with traces, runbooks, and debugging context
- 🔐 **Security & Compliance**: PII detection, audit logs, and GDPR-compliant data handling

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                     │
│                   Datadog RUM + Session Replay                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Gateway (Supabase Edge Functions)          │
│                  OpenTelemetry + Datadog APM                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Supabase    │ │  Vertex AI   │ │  Datadog     │
    │  PostgreSQL  │ │  (Gemini)    │ │  Platform    │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (already configured)
- Datadog account ([Sign up free](https://www.datadoghq.com/))
- Google Cloud account with Vertex AI enabled (optional)

### 1. Clone & Install

\`\`\`bash
git clone https://github.com/your-org/observability-hub.git
cd observability-hub
npm install
\`\`\`

### 2. Configure Environment

Copy \`.env.example\` to \`.env\` and fill in your credentials:

\`\`\`bash
# Already configured ✅
VITE_SUPABASE_URL=https://nztdwsnmttwwjticuphi.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Add these ⚠️
VITE_DD_APPLICATION_ID=your_datadog_app_id
VITE_DD_CLIENT_TOKEN=your_datadog_client_token
DD_API_KEY=your_datadog_api_key

# Optional: Vertex AI
VITE_GCP_PROJECT_ID=your_gcp_project
GCP_SERVICE_ACCOUNT_KEY=your_service_account_json
\`\`\`

### 3. Test Database Connection

\`\`\`bash
npm run test:db
\`\`\`

Expected output:
\`\`\`
✅ PASS       | Database Connection                 | Connected successfully
✅ EXISTS     | Table: organizations
✅ EXISTS     | Table: llm_metrics
... (all 13 tables)
✅ All critical tests passed! Supabase is ready.
\`\`\`

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit: [http://localhost:5173](http://localhost:5173)

### 5. Build for Production

\`\`\`bash
npm run build
npm run preview
\`\`\`

---

## 📊 Datadog Setup

### Step 1: Get Datadog Credentials

1. Log in to [Datadog](https://app.datadoghq.com/)
2. Go to **Organization Settings** → **API Keys**
3. Create a new API key for backend
4. Go to **Organization Settings** → **Client Tokens**
5. Create a new client token for frontend RUM
6. Go to **UX Monitoring** → **RUM Applications**
7. Create a new application and note the Application ID

### Step 2: Import Dashboards

\`\`\`bash
cd datadog/dashboards
# Use Datadog API or Terraform to import dashboards
terraform apply
\`\`\`

Or manually import via Datadog UI:
- Dashboard → New Dashboard → Import JSON
- Upload \`datadog/dashboards/llm-overview.json\`

### Step 3: Configure Monitors

\`\`\`bash
# Import monitors using Datadog Terraform provider
cd datadog
terraform init
terraform plan
terraform apply
\`\`\`

### Step 4: Set Up Log Pipelines

1. Go to **Logs** → **Pipelines** in Datadog
2. Create new pipeline: "LLM Inference Processing"
3. Copy configuration from \`datadog/log-pipelines.yaml\`
4. Add processors as defined in the YAML

---

## 🔍 Observability Features

### Real User Monitoring (RUM)

- ✅ Page load performance tracking
- ✅ User interaction tracking
- ✅ Session replay (20% of sessions)
- ✅ Error tracking with full stack traces
- ✅ Custom LLM event tracking

### Application Performance Monitoring (APM)

- ✅ Distributed tracing across all services
- ✅ Trace correlation with logs
- ✅ Database query performance
- ✅ External API call tracking
- ✅ Custom spans for LLM operations

### Log Management

- ✅ Structured JSON logging
- ✅ Automatic log parsing and enrichment
- ✅ PII redaction
- ✅ Log-to-trace correlation
- ✅ Custom facets for LLM metrics

### Custom Metrics

Key LLM metrics tracked:
- \`ai.requests.count\` - Total AI requests
- \`ai.model.latency\` - Model inference latency (p50/p95/p99)
- \`ai.prompt.tokens\` - Prompt token count
- \`ai.response.tokens\` - Response token count
- \`ai.confidence\` - Model confidence score
- \`ai.hallucination.score\` - Hallucination risk score
- \`ai.embedding.distance\` - Embedding drift metric
- \`billing.api_cost.usd\` - API cost tracking

### Anomaly Detection

9 pre-configured monitors for:
1. **Hallucination Detection** - High hallucination risk
2. **High Latency** - Model inference > 2s
3. **Cost Spikes** - Unusual token usage
4. **Prompt Injection** - Security threats
5. **PII Leakage** - Data privacy violations
6. **Model Drift** - Embedding distance increase
7. **Error Rate** - High failure rate
8. **Streaming Issues** - WebSocket disruptions
9. **System Health** - Composite health check

---

## 🛠️ Development

### Project Structure

\`\`\`
observability-hub/
├── src/
│   ├── lib/
│   │   ├── datadog.ts              # Datadog instrumentation
│   │   ├── supabaseClient.ts       # Supabase client config
│   │   ├── api-hooks.ts            # TanStack Query hooks
│   │   └── realtime.ts             # Real-time subscriptions
│   ├── pages/
│   │   └── dashboard/
│   │       ├── Overview.tsx        # Main dashboard
│   │       ├── LLMMetrics.tsx      # LLM-specific metrics
│   │       ├── Anomalies.tsx       # Anomaly detection
│   │       └── LogStream.tsx       # Live log viewer
│   └── components/                 # Reusable UI components
├── supabase/
│   ├── functions/                  # Edge Functions (Deno)
│   │   ├── ingest/                 # Telemetry ingestion
│   │   └── cron/                   # Background jobs
│   └── migrations/                 # Database schema
├── datadog/
│   ├── datadog.yaml                # Agent configuration
│   ├── log-pipelines.yaml          # Log processing rules
│   ├── monitors.yaml               # Alert definitions
│   └── dashboards/                 # Dashboard JSONs
├── config/
│   └── observability/
│       └── otel-collector-config.yaml  # OpenTelemetry config
└── scripts/
    └── test-supabase-connection.ts # Database connectivity test
\`\`\`

### Available Scripts

\`\`\`bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test:db      # Test Supabase connection
\`\`\`

### Adding Custom Metrics

\`\`\`typescript
import { trackLLMEvent } from '@/lib/datadog';

// Track LLM request
trackLLMEvent({
  model: 'gemini-pro',
  promptTokens: 128,
  responseTokens: 256,
  latency: 1234,
  confidence: 0.91
});
\`\`\`

### Tracking Hallucinations

\`\`\`typescript
import { trackHallucinationEvent } from '@/lib/datadog';

trackHallucinationEvent({
  model: 'gemini-pro',
  score: 0.75,
  requestId: 'req-123',
  embeddingDistance: 0.42
});
\`\`\`

---

## 📈 Monitoring Best Practices

### 1. Set Up Alerts

Configure notification channels:
- Slack: \`#observai-oncall\`
- PagerDuty: Critical incidents
- Email: Non-critical alerts

### 2. Review Dashboards Daily

Key metrics to watch:
- Request volume trends
- Latency percentiles (p95, p99)
- Error rate < 1%
- Hallucination detections
- Cost per 1M tokens

### 3. Incident Response

When an alert fires:
1. Check Datadog dashboard
2. Review attached traces
3. Analyze log context
4. Follow runbook steps
5. Document resolution

### 4. Cost Optimization

Monitor these metrics:
- Token usage by model
- Cost per organization
- Unused API keys
- Inefficient prompts

---

## 🔐 Security & Compliance

### PII Protection

- ✅ Automatic PII detection in logs
- ✅ Redaction of sensitive data
- ✅ GDPR-compliant data handling
- ✅ Audit logs for all data access

### API Key Security

- ✅ Keys stored in environment variables
- ✅ Never committed to version control
- ✅ Automatic key rotation support
- ✅ Rate limiting per API key

### Data Retention

- Logs: 15 days (configurable)
- Metrics: 15 months
- Traces: 15 days
- RUM sessions: 30 days

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Best Practices](docs/SECURITY.md)
- [API Documentation](docs/API.md)

---

## 🎓 Learning Resources

### Datadog
- [Datadog RUM Documentation](https://docs.datadoghq.com/real_user_monitoring/)
- [OpenTelemetry with Datadog](https://docs.datadoghq.com/tracing/setup_overview/open_standards/otel_collector_datadog_exporter/)
- [Log Management Guide](https://docs.datadoghq.com/logs/)

### Vertex AI
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Reference](https://ai.google.dev/docs)

### Supabase
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [PostgreSQL Performance](https://supabase.com/docs/guides/database/performance)

---

## 📊 Demo & Screenshots

### Dashboard Preview

![LLM Overview Dashboard](docs/images/dashboard-overview.png)

### Hallucination Detection

![Hallucination Alert](docs/images/hallucination-alert.png)

### Cost Tracking

![Cost Analysis](docs/images/cost-tracking.png)

---

## ✅ Deployment Checklist

- [ ] Configure \`.env\` with all credentials
- [ ] Test database connection (\`npm run test:db\`)
- [ ] Import Datadog dashboards
- [ ] Configure Datadog monitors
- [ ] Set up log pipelines
- [ ] Configure alert notification channels
- [ ] Deploy Edge Functions to Supabase
- [ ] Enable Vertex AI API in GCP
- [ ] Set up Upstash Redis (optional)
- [ ] Configure custom domain (optional)
- [ ] Enable HTTPS/SSL
- [ ] Set up CI/CD pipeline
- [ ] Load test with synthetic traffic
- [ ] Document runbooks
- [ ] Train team on incident response

---

## 🏆 Hackathon Submission

**Event**: Datadog × Google Cloud Hackathon 2024

**Category**: Observability for AI Applications

**Demo Video**: [Watch on YouTube](https://youtube.com/watch?v=...)

**Live Demo**: [https://observai.dev](https://observai.dev)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **Datadog** - For the amazing observability platform
- **Google Cloud** - For Vertex AI and infrastructure
- **Supabase** - For the backend platform
- **Open Source Community** - For all the great tools

---

## 📧 Contact

- **Email**: team@observai.dev
- **Twitter**: [@ObservAI](https://twitter.com/observai)
- **Discord**: [Join our community](https://discord.gg/observai)
- **GitHub**: [observai/observability-hub](https://github.com/observai/observability-hub)

---

<div align="center">

**Built with ❤️ for the AI engineering community**

[⭐ Star us on GitHub](https://github.com/observai/observability-hub) | [🐦 Follow on Twitter](https://twitter.com/observai) | [📖 Read the docs](https://docs.observai.dev)

</div>
