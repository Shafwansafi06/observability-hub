import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@datadog/browser-rum-react";
import { initializeDatadogMonitoring } from "./lib/datadog-apm.ts";
import { initObservabilityService } from "./lib/observability-service.ts";
import "./lib/seed-data.ts"; // Load seed utility for console access

// Initialize Datadog monitoring (RUM, Logs, APM)
// Always try to initialize if credentials are available
if (import.meta.env.VITE_DD_CLIENT_TOKEN && import.meta.env.VITE_DD_APPLICATION_ID) {
  try {
    console.log('🔧 Initializing Datadog...');
    console.log('📍 Environment:', import.meta.env.VITE_DD_ENV || 'production');
    console.log('📍 Site:', import.meta.env.VITE_DD_SITE || 'datadoghq.com');
    
    initializeDatadogMonitoring();
    
    console.log('🔍 Datadog APM + RUM + Logs initialized');
    console.log('📊 Enhanced telemetry: LLM metrics, ML quality signals, security events');
    console.log('🌐 View data at: https://app.' + (import.meta.env.VITE_DD_SITE || 'datadoghq.com'));
  } catch (error) {
    console.error('❌ Datadog initialization failed:', error);
  }
} else {
  console.warn('⚠️ Datadog not initialized - missing credentials');
  console.warn('Required: VITE_DD_CLIENT_TOKEN and VITE_DD_APPLICATION_ID');
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
  <ErrorBoundary
    fallback={({ error }) => (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    )}
  >
    <App />
  </ErrorBoundary>
);
