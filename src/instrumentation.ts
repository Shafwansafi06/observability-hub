import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry Instrumentation for Vercel App
 * This setup captures frontend traces and sends them to a central OTel Collector.
 */

const exporter = new OTLPTraceExporter({
    url: process.env.NEXT_PUBLIC_OTEL_COLLECTOR_URL || 'http://localhost:4318/v1/traces',
});

const resource = defaultResource().merge(resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'observai-frontend',
}));

const provider = new WebTracerProvider({
    resource,
});

// Fix: Bypassing potential strict type check issue for addSpanProcessor
// in experimental/newer versions of OTel SDKs.
(provider as any).addSpanProcessor(new SimpleSpanProcessor(exporter as any));

provider.register();

console.log('OpenTelemetry initialized: Traces are being sent to', (exporter as any)._url);
