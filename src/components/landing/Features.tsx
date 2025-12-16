import { cn } from "@/lib/utils";
import {
  Brain,
  Shield,
  Zap,
  BarChart3,
  Bell,
  GitBranch,
  Database,
  Cloud,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "LLM-Level Telemetry",
    description:
      "Track tokens, latencies, model confidence, embeddings, and prompt-response pairs for deep AI observability.",
  },
  {
    icon: Shield,
    title: "AI Safety Detection",
    description:
      "Detect hallucinations, prompt injections, data leakage, and other AI-specific failure modes in real-time.",
  },
  {
    icon: Zap,
    title: "Sub-second Alerting",
    description:
      "Get notified within seconds of anomalies. Automated incident creation with contextual runbooks.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Datadog-style dashboards with infrastructure, application, and model-level metrics in one view.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Context-rich alerts with trace IDs, sample prompts, model outputs, and reproducible debugging packages.",
  },
  {
    icon: GitBranch,
    title: "Distributed Tracing",
    description:
      "OpenTelemetry-powered tracing from user request to model inference and back.",
  },
  {
    icon: Database,
    title: "Vertex AI Integration",
    description:
      "Native integration with Google Cloud's Vertex AI and Gemini models for enterprise LLM inference.",
  },
  {
    icon: Cloud,
    title: "Cloud-Native",
    description:
      "Deploy on GKE or Cloud Run with Terraform IaC. Scale from prototype to millions of users.",
  },
];

export function Features() {
  return (
    <section className="py-24 relative overflow-hidden" id="features">
      <div className="absolute inset-0 gradient-glow opacity-50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need for{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">LLM Observability</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive monitoring, detection, and debugging tools for your AI applications.
            Built for the modern AI engineer.
          </p>
          <div className="mt-6">
            <a 
              href="/docs" 
              className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-2 transition-colors"
            >
              Learn more in the documentation
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "group p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm",
                "hover:border-primary/30 hover:bg-card hover:shadow-xl hover:shadow-primary/5",
                "transition-all duration-300 hover:-translate-y-1",
                "animate-fade-in-up"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
