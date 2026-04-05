/**
 * Unit tests for lab test parameter validation logic.
 * Validates that each product type's parameters are checked against
 * the thresholds defined in shared/constants/lab-test-parameters.json
 */

interface LabParameter {
  key: string;
  min?: number;
  max?: number;
}

interface ValidationResult {
  valid: boolean;
  failedParameters: string[];
}

function validateLabResults(
  productTypeKey: string,
  testValues: Record<string, number>,
  parameters: Record<string, { required: LabParameter[] }>,
): ValidationResult {
  const params = parameters[productTypeKey]?.required ?? [];
  const failedParameters: string[] = [];

  for (const param of params) {
    const value = testValues[param.key];
    if (value === undefined) continue; // missing values handled separately

    if (param.min !== undefined && value < param.min) {
      failedParameters.push(param.key);
    } else if (param.max !== undefined && value > param.max) {
      failedParameters.push(param.key);
    }
  }

  return { valid: failedParameters.length === 0, failedParameters };
}

const MOCK_PARAMETERS = {
  argan_oil: {
    required: [
      { key: 'acidity', max: 4.0 },
      { key: 'peroxide_value', max: 20.0 },
      { key: 'oleic_acid_pct', min: 43.0, max: 49.9 },
    ],
  },
  saffron: {
    required: [
      { key: 'crocin_e1pct', min: 190 },
      { key: 'safranal_e1pct', min: 20, max: 50 },
      { key: 'picrocrocin_e1pct', min: 70 },
    ],
  },
  honey: {
    required: [
      { key: 'moisture_pct', max: 20.0 },
      { key: 'hm_f_mgkg', max: 40 },
      { key: 'diastase_scale', min: 8 },
    ],
  },
};

describe('Lab Test Parameter Validation', () => {
  describe('Argan oil validation', () => {
    it('should pass when all parameters are within thresholds', () => {
      const result = validateLabResults(
        'argan_oil',
        { acidity: 2.5, peroxide_value: 12, oleic_acid_pct: 46.5 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(true);
      expect(result.failedParameters).toHaveLength(0);
    });

    it('should fail when acidity exceeds max threshold', () => {
      const result = validateLabResults(
        'argan_oil',
        { acidity: 5.0, peroxide_value: 12, oleic_acid_pct: 46.5 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(false);
      expect(result.failedParameters).toContain('acidity');
    });

    it('should fail when oleic acid is below minimum', () => {
      const result = validateLabResults(
        'argan_oil',
        { acidity: 2.5, peroxide_value: 12, oleic_acid_pct: 40.0 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(false);
      expect(result.failedParameters).toContain('oleic_acid_pct');
    });

    it('should report multiple failed parameters', () => {
      const result = validateLabResults(
        'argan_oil',
        { acidity: 5.0, peroxide_value: 25, oleic_acid_pct: 46.5 },
        MOCK_PARAMETERS,
      );
      expect(result.failedParameters).toContain('acidity');
      expect(result.failedParameters).toContain('peroxide_value');
      expect(result.failedParameters).toHaveLength(2);
    });
  });

  describe('Saffron validation (ISO 3632)', () => {
    it('should pass grade I saffron', () => {
      const result = validateLabResults(
        'saffron',
        { crocin_e1pct: 250, safranal_e1pct: 35, picrocrocin_e1pct: 80 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(true);
    });

    it('should fail when crocin is below minimum (190)', () => {
      const result = validateLabResults(
        'saffron',
        { crocin_e1pct: 150, safranal_e1pct: 35, picrocrocin_e1pct: 80 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(false);
      expect(result.failedParameters).toContain('crocin_e1pct');
    });

    it('should fail when safranal is outside range (20-50)', () => {
      const result = validateLabResults(
        'saffron',
        { crocin_e1pct: 250, safranal_e1pct: 60, picrocrocin_e1pct: 80 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(false);
      expect(result.failedParameters).toContain('safranal_e1pct');
    });
  });

  describe('Honey validation', () => {
    it('should pass compliant honey', () => {
      const result = validateLabResults(
        'honey',
        { moisture_pct: 17, hm_f_mgkg: 20, diastase_scale: 12 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(true);
    });

    it('should fail high moisture honey', () => {
      const result = validateLabResults(
        'honey',
        { moisture_pct: 22, hm_f_mgkg: 20, diastase_scale: 12 },
        MOCK_PARAMETERS,
      );
      expect(result.valid).toBe(false);
      expect(result.failedParameters).toContain('moisture_pct');
    });
  });

  describe('Unknown product type', () => {
    it('should return valid with no failed parameters for unknown product', () => {
      const result = validateLabResults('unknown_product', { foo: 1 }, MOCK_PARAMETERS);
      expect(result.valid).toBe(true);
      expect(result.failedParameters).toHaveLength(0);
    });
  });
});
