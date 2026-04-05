/**
 * Unit tests for Morocco-specific validators.
 * These validators live in src/common/validators/ and are used across all modules.
 */

// CIN: 1-2 uppercase letters followed by 5-6 digits (e.g., A123456, BE12345)
function isValidCIN(cin: string): boolean {
  return /^[A-Z]{1,2}\d{5,6}$/.test(cin);
}

// ICE: exactly 15 digits
function isValidICE(ice: string): boolean {
  return /^\d{15}$/.test(ice);
}

// Moroccan phone: +212 followed by 9 digits (no leading 0)
function isValidPhone(phone: string): boolean {
  return /^\+212[5-7]\d{8}$/.test(phone);
}

// IF: 7-8 digits
function isValidIF(taxId: string): boolean {
  return /^\d{7,8}$/.test(taxId);
}

describe('Morocco Validators', () => {
  describe('CIN validation', () => {
    it('should accept valid CIN formats', () => {
      expect(isValidCIN('A123456')).toBe(true);
      expect(isValidCIN('BE12345')).toBe(true);
      expect(isValidCIN('Z999999')).toBe(true);
      expect(isValidCIN('AB654321')).toBe(true);
    });

    it('should reject invalid CIN formats', () => {
      expect(isValidCIN('1234567')).toBe(false);    // no letters
      expect(isValidCIN('ABC1234')).toBe(false);   // 3 letters
      expect(isValidCIN('A1234')).toBe(false);     // too few digits
      expect(isValidCIN('A1234567')).toBe(false);  // too many digits
      expect(isValidCIN('')).toBe(false);
    });
  });

  describe('ICE validation', () => {
    it('should accept valid 15-digit ICE', () => {
      expect(isValidICE('001234567890123')).toBe(true);
      expect(isValidICE('123456789012345')).toBe(true);
    });

    it('should reject invalid ICE', () => {
      expect(isValidICE('12345678901234')).toBe(false);   // 14 digits
      expect(isValidICE('1234567890123456')).toBe(false); // 16 digits
      expect(isValidICE('12345678901234A')).toBe(false);  // has letter
    });
  });

  describe('Phone validation', () => {
    it('should accept valid Moroccan mobile numbers', () => {
      expect(isValidPhone('+212612345678')).toBe(true);
      expect(isValidPhone('+212712345678')).toBe(true);
      expect(isValidPhone('+212512345678')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidPhone('0612345678')).toBe(false);      // missing country code
      expect(isValidPhone('+33612345678')).toBe(false);    // French number
      expect(isValidPhone('+2121234567')).toBe(false);     // 8 digits after 212
      expect(isValidPhone('+21212345678')).toBe(false);    // landline with 0
    });
  });

  describe('IF (Identifiant Fiscal) validation', () => {
    it('should accept 7-8 digit tax IDs', () => {
      expect(isValidIF('1234567')).toBe(true);
      expect(isValidIF('12345678')).toBe(true);
    });

    it('should reject invalid IF', () => {
      expect(isValidIF('123456')).toBe(false);   // 6 digits
      expect(isValidIF('123456789')).toBe(false); // 9 digits
      expect(isValidIF('12A4567')).toBe(false);   // has letter
    });
  });
});
