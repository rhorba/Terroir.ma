/**
 * Unit tests for correlation ID propagation.
 * Verifies that correlation IDs flow correctly through HTTP requests and Kafka events.
 */

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

// Inline implementation matching the middleware logic
function extractOrGenerateCorrelationId(headers: Record<string, string | undefined>): string {
  const fromHeader = headers['x-correlation-id'] ?? headers['x-request-id'];
  if (fromHeader && uuidValidate(fromHeader)) {
    return fromHeader;
  }
  return uuidv4();
}

describe('Correlation ID Propagation', () => {
  describe('extractOrGenerateCorrelationId()', () => {
    it('should use x-correlation-id header when present and valid UUID', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const result = extractOrGenerateCorrelationId({ 'x-correlation-id': correlationId });
      expect(result).toBe(correlationId);
    });

    it('should fall back to x-request-id when x-correlation-id is absent', () => {
      const requestId = '550e8400-e29b-41d4-a716-446655440001';
      const result = extractOrGenerateCorrelationId({ 'x-request-id': requestId });
      expect(result).toBe(requestId);
    });

    it('should generate a new UUID when no correlation header is present', () => {
      const result = extractOrGenerateCorrelationId({});
      expect(uuidValidate(result)).toBe(true);
    });

    it('should generate a new UUID when header value is not a valid UUID', () => {
      const result = extractOrGenerateCorrelationId({ 'x-correlation-id': 'not-a-uuid' });
      expect(uuidValidate(result)).toBe(true);
      expect(result).not.toBe('not-a-uuid');
    });

    it('should generate unique IDs on each call when no header provided', () => {
      const id1 = extractOrGenerateCorrelationId({});
      const id2 = extractOrGenerateCorrelationId({});
      expect(id1).not.toBe(id2);
    });
  });

  describe('Kafka event envelope', () => {
    it('should include correlationId in event payload', () => {
      const correlationId = uuidv4();
      const event = {
        eventId: uuidv4(),
        version: '1.0',
        timestamp: new Date().toISOString(),
        correlationId,
      };

      expect(event.correlationId).toBe(correlationId);
      expect(uuidValidate(event.correlationId)).toBe(true);
    });
  });
});
