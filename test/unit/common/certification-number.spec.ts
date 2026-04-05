/**
 * Unit tests for certification number generation.
 * Format: TERROIR-{IGP|AOP|LA}-{REGION_CODE}-{YEAR}-{SEQ}
 * Agricultural campaign year: October (year N) → September (year N+1) → year = N
 */

type CertificationType = 'IGP' | 'AOP' | 'LA';

function buildCertificationNumber(
  type: CertificationType,
  regionCode: string,
  campaignYear: number,
  sequence: number,
): string {
  const seq = String(sequence).padStart(3, '0');
  return `TERROIR-${type}-${regionCode}-${campaignYear}-${seq}`;
}

function getCampaignYear(date: Date): number {
  // Campaign starts October 1 — if month is Oct-Dec, campaign year = current year
  // If month is Jan-Sep, campaign year = previous year
  const month = date.getMonth(); // 0-indexed
  return month >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

describe('Certification Number', () => {
  describe('buildCertificationNumber()', () => {
    it('should format number correctly for AOP', () => {
      expect(buildCertificationNumber('AOP', 'MRR', 2025, 1)).toBe('TERROIR-AOP-MRR-2025-001');
    });

    it('should format number correctly for IGP', () => {
      expect(buildCertificationNumber('IGP', 'SFI', 2024, 42)).toBe('TERROIR-IGP-SFI-2024-042');
    });

    it('should format number correctly for LA', () => {
      expect(buildCertificationNumber('LA', 'DKH', 2025, 999)).toBe('TERROIR-LA-DKH-2025-999');
    });

    it('should zero-pad sequence numbers', () => {
      expect(buildCertificationNumber('AOP', 'FES', 2025, 7)).toBe('TERROIR-AOP-FES-2025-007');
    });
  });

  describe('getCampaignYear()', () => {
    it('should return current year for October–December', () => {
      expect(getCampaignYear(new Date('2025-10-01'))).toBe(2025);
      expect(getCampaignYear(new Date('2025-12-31'))).toBe(2025);
    });

    it('should return previous year for January–September', () => {
      expect(getCampaignYear(new Date('2026-01-01'))).toBe(2025);
      expect(getCampaignYear(new Date('2026-09-30'))).toBe(2025);
    });

    it('should handle campaign boundary correctly', () => {
      // Sep 30 = last day of campaign N-1 → year = N-1
      expect(getCampaignYear(new Date('2025-09-30'))).toBe(2024);
      // Oct 1 = first day of campaign N → year = N
      expect(getCampaignYear(new Date('2025-10-01'))).toBe(2025);
    });
  });
});
