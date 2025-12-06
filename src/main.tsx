import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeDatadogMonitoring } from "./lib/datadog.ts";
import { initObservabilityService } from "./lib/observability-service.ts";

// Initialize Datadog monitoring (RUM, Logs, Traces)
if (import.meta.env.PROD || import.meta.env.VITE_DD_CLIENT_TOKEN) {
  initializeDatadogMonitoring();
  console.log('🔍 Datadog monitoring initialized');
}

// Initialize ObservAI observability service
initObservabilityService();
console.log('🚀 ObservAI Hub initialized');

createRoot(document.getElementById("root")!).render(<App />);
