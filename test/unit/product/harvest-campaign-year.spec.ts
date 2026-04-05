import { HarvestService } from '../../../src/modules/product/services/harvest.service';

/**
 * Unit tests for HarvestService.computeCampaignYear().
 * Morocco's agricultural campaign runs October → September.
 * A harvest on 2025-10-01 → "2025/2026"
 * A harvest on 2025-09-30 → "2024/2025"
 */
describe('HarvestService.computeCampaignYear()', () => {
  it('should return current year range for October 1 (start of campaign)', () => {
    expect(HarvestService.computeCampaignYear('2025-10-01')).toBe('2025/2026');
  });

  it('should return current year range for December 31', () => {
    expect(HarvestService.computeCampaignYear('2025-12-31')).toBe('2025/2026');
  });

  it('should return previous year range for September 30 (last day of campaign)', () => {
    expect(HarvestService.computeCampaignYear('2025-09-30')).toBe('2024/2025');
  });

  it('should return previous year range for January 1', () => {
    expect(HarvestService.computeCampaignYear('2026-01-01')).toBe('2025/2026');
  });

  it('should handle the exact campaign boundary: Sep 30 vs Oct 1', () => {
    expect(HarvestService.computeCampaignYear('2024-09-30')).toBe('2023/2024');
    expect(HarvestService.computeCampaignYear('2024-10-01')).toBe('2024/2025');
  });

  it('should return correct range for mid-campaign harvest (January saffron)', () => {
    // Taliouine saffron harvested Oct–Nov; a January processing date still same campaign
    expect(HarvestService.computeCampaignYear('2026-01-15')).toBe('2025/2026');
  });

  it('should return correct range for argan oil harvest season (July–August)', () => {
    // Argan fruits fall July–September — belongs to the ending campaign
    expect(HarvestService.computeCampaignYear('2025-08-15')).toBe('2024/2025');
  });
});
