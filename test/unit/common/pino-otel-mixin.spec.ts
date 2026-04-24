import { trace, Span, SpanContext } from '@opentelemetry/api';
import { otelMixin } from '@common/logger/pino-otel-mixin';

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: jest.fn(),
  },
}));

describe('otelMixin', () => {
  const mockGetActiveSpan = trace.getActiveSpan as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty object when getActiveSpan returns undefined', () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    expect(otelMixin()).toEqual({});
  });

  it('returns empty object when getActiveSpan returns null', () => {
    mockGetActiveSpan.mockReturnValue(null);
    expect(otelMixin()).toEqual({});
  });

  it('returns traceId and spanId from the active span context', () => {
    const fakeContext: SpanContext = {
      traceId: 'aabbccdd00112233aabbccdd00112233',
      spanId: '0011223344556677',
      traceFlags: 1,
    };
    const fakeSpan = { spanContext: () => fakeContext } as unknown as Span;
    mockGetActiveSpan.mockReturnValue(fakeSpan);

    expect(otelMixin()).toEqual({
      traceId: 'aabbccdd00112233aabbccdd00112233',
      spanId: '0011223344556677',
    });
  });
});
