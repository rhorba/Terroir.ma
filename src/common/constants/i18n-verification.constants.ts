/** Supported display languages for the public QR verification endpoint. */
export type SupportedLang = 'ar' | 'fr' | 'zgh';

/** Default language when ?lang= param is absent or invalid. */
export const DEFAULT_LANG: SupportedLang = 'fr';

/** Languages that require right-to-left layout. */
export const RTL_LANGS: SupportedLang[] = ['ar'];

/** Returns true if the given string is a recognised SupportedLang code. */
export function isSupportedLang(lang: string): lang is SupportedLang {
  return ['ar', 'fr', 'zgh'].includes(lang);
}

/** Returns true if the given language requires RTL layout. */
export function isRtlLang(lang: SupportedLang): boolean {
  return RTL_LANGS.includes(lang);
}

/**
 * Certification status display labels — shown on the consumer-facing verification page.
 * Keys match CertificationStatus enum values.
 */
export const VERIFICATION_STATUS_I18N: Record<string, Record<SupportedLang, string>> = {
  GRANTED: { fr: 'Certifié', ar: 'معتمد', zgh: 'ⴰⵙⵉⴼⵍⵍ' },
  RENEWED: { fr: 'Renouvelé', ar: 'مجدد', zgh: 'ⴰⵙⵏⴼⵍⵉ' },
  REVOKED: { fr: 'Révoqué', ar: 'ملغى', zgh: 'ⴰⴽⴽⴰ' },
  DENIED: { fr: 'Refusé', ar: 'مرفوض', zgh: 'ⵓⵔ ⵉⵇⴱⵍ' },
  EXPIRED: { fr: 'Expiré', ar: 'منتهي الصلاحية', zgh: 'ⵉⵎⵎⵓⵜ' },
};

/** Verification result message keys. */
export type VerificationMessageKey = 'valid' | 'invalid' | 'revoked' | 'expired' | 'renewed';

/**
 * Consumer-facing verification messages per language.
 * Used as the `message` field in the QR verification response.
 */
export const VERIFICATION_MESSAGE_I18N: Record<
  VerificationMessageKey,
  Record<SupportedLang, string>
> = {
  valid: { fr: 'Produit certifié', ar: 'منتج معتمد', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⵙⵉⴼⵍⵍ' },
  invalid: { fr: 'Certification invalide', ar: 'شهادة غير صالحة', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵓⵔ ⵉⵍⵍⵉ' },
  revoked: { fr: 'Produit révoqué', ar: 'منتج ملغى', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⴽⴽⴰ' },
  expired: { fr: 'Certificat expiré', ar: 'شهادة منتهية', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵉⵎⵎⵓⵜ' },
  renewed: { fr: 'Certificat renouvelé', ar: 'شهادة مجددة', zgh: 'ⴰⵙⵉⴼⵍⵍ ⴰⵙⵏⴼⵍⵉ' },
};

/**
 * Resolves the message key for a QR verification result.
 * Caller passes the certification status string and whether the result is valid.
 */
export function resolveMessageKey(
  valid: boolean,
  certStatus?: string,
  qrExpired?: boolean,
): VerificationMessageKey {
  if (valid) return 'valid';
  if (qrExpired) return 'expired';
  if (certStatus === 'REVOKED') return 'revoked';
  if (certStatus === 'RENEWED') return 'renewed';
  return 'invalid';
}
