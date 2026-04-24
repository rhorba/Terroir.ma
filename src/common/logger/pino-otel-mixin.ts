import { trace } from '@opentelemetry/api';

/**
 * Returns traceId + spanId from the active OTel span, or {} if no span is active.
 * Used as pino-http customProps to correlate log lines with Jaeger traces.
 */
export function otelMixin(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}
