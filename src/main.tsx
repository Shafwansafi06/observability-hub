import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initializeDatadogMonitoring } from "./lib/datadog-apm.ts";
import { initObservabilityService } from "./lib/observability-service.ts";
import "./lib/seed-data.ts"; // Load seed utility for console access

// Initialize Datadog monitoring (RUM, Logs, APM)
if (import.meta.env.PROD || import.meta.env.VITE_DD_CLIENT_TOKEN) {
  try {
    initializeDatadogMonitoring();
    console.log('🔍 Datadog APM + RUM + Logs initialized');
    console.log('📊 Enhanced telemetry: LLM metrics, ML quality signals, security events');
  } catch (error) {
    console.warn('Datadog initialization failed:', error);
  }
}

// Initialize ObservAI observability service
try {
  initObservabilityService();
  console.log('🚀 ObservAI Hub initialized with competition-grade instrumentation');
  console.log('💡 Use window.seedData.seedAllData() to populate demo data');
} catch (error) {
  console.warn('ObservAI service initialization failed:', error);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
