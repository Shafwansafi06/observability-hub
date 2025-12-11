import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeDatadogMonitoring } from "./lib/datadog-apm.ts";
import { initObservabilityService } from "./lib/observability-service.ts";

// Initialize Datadog monitoring (RUM, Logs, APM)
if (import.meta.env.PROD || import.meta.env.VITE_DD_CLIENT_TOKEN) {
  initializeDatadogMonitoring();
  console.log('🔍 Datadog APM + RUM + Logs initialized');
  console.log('📊 Enhanced telemetry: LLM metrics, ML quality signals, security events');
}

// Initialize ObservAI observability service
initObservabilityService();
console.log('🚀 ObservAI Hub initialized with competition-grade instrumentation');

createRoot(document.getElementById("root")!).render(<App />);
