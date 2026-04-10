import {
  isSupportedLang,
  isRtlLang,
  resolveMessageKey,
  VERIFICATION_STATUS_I18N,
  VERIFICATION_MESSAGE_I18N,
  DEFAULT_LANG,
} from '../../../src/common/constants/i18n-verification.constants';

describe('i18n-verification constants', () => {
  describe('isSupportedLang()', () => {
    it('returns true for ar', () => expect(isSupportedLang('ar')).toBe(true));
    it('returns true for fr', () => expect(isSupportedLang('fr')).toBe(true));
    it('returns true for zgh', () => expect(isSupportedLang('zgh')).toBe(true));
    it('returns false for en', () => expect(isSupportedLang('en')).toBe(false));
    it('returns false for empty string', () => expect(isSupportedLang('')).toBe(false));
    it('returns false for undefined-like input', () =>
      expect(isSupportedLang('undefined')).toBe(false));
  });

  describe('DEFAULT_LANG', () => {
    it('is fr', () => expect(DEFAULT_LANG).toBe('fr'));
  });

  describe('isRtlLang()', () => {
    it('returns true for ar', () => expect(isRtlLang('ar')).toBe(true));
    it('returns false for fr', () => expect(isRtlLang('fr')).toBe(false));
    it('returns false for zgh', () => expect(isRtlLang('zgh')).toBe(false));
  });

  describe('resolveMessageKey()', () => {
    it('returns valid when result is valid', () => {
      expect(resolveMessageKey(true, 'GRANTED')).toBe('valid');
    });

    it('returns revoked when cert is REVOKED', () => {
      expect(resolveMessageKey(false, 'REVOKED')).toBe('revoked');
    });

    it('returns renewed when cert is RENEWED', () => {
      expect(resolveMessageKey(false, 'RENEWED')).toBe('renewed');
    });

    it('returns expired when QR is expired', () => {
      expect(resolveMessageKey(false, 'GRANTED', true)).toBe('expired');
    });

    it('returns invalid as fallback for unknown status', () => {
      expect(resolveMessageKey(false, 'DENIED')).toBe('invalid');
    });

    it('returns invalid when cert status is undefined', () => {
      expect(resolveMessageKey(false, undefined)).toBe('invalid');
    });

    it('expired takes priority over status check', () => {
      expect(resolveMessageKey(false, 'REVOKED', true)).toBe('expired');
    });
  });

  describe('VERIFICATION_STATUS_I18N', () => {
    it('has French, Arabic, and Amazigh for GRANTED', () => {
      const granted = VERIFICATION_STATUS_I18N['GRANTED']!;
      expect(granted['fr']).toBe('Certifié');
      expect(granted['ar']).toBe('معتمد');
      expect(granted['zgh']).toBe('ⴰⵙⵉⴼⵍⵍ');
    });

    it('has translations for REVOKED', () => {
      const revoked = VERIFICATION_STATUS_I18N['REVOKED']!;
      expect(revoked['fr']).toBe('Révoqué');
      expect(revoked['ar']).toBe('ملغى');
    });
  });

  describe('VERIFICATION_MESSAGE_I18N', () => {
    it('valid message is correct in all languages', () => {
      expect(VERIFICATION_MESSAGE_I18N['valid']['fr']).toBe('Produit certifié');
      expect(VERIFICATION_MESSAGE_I18N['valid']['ar']).toBe('منتج معتمد');
      expect(VERIFICATION_MESSAGE_I18N['valid']['zgh']).toContain('ⴰⵎⵣⵣⴰⵏ');
    });

    it('invalid message exists in all languages', () => {
      expect(VERIFICATION_MESSAGE_I18N['invalid']['fr']).toBeTruthy();
      expect(VERIFICATION_MESSAGE_I18N['invalid']['ar']).toBeTruthy();
      expect(VERIFICATION_MESSAGE_I18N['invalid']['zgh']).toBeTruthy();
    });
  });
});
