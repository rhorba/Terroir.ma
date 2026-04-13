export interface StatusCount {
  status: string;
  count: number;
}

export interface RegionCount {
  regionCode: string;
  count: number;
}

export interface ProductTypeCount {
  productTypeCode: string;
  count: number;
}

export interface CertificationStats {
  period: { from: string | null; to: string | null };
  byStatus: StatusCount[];
  byRegion: RegionCount[];
  byProductType: ProductTypeCount[];
}

/** US-083: One row per cooperative in the compliance report. */
export interface CooperativeComplianceRow {
  cooperativeId: string;
  cooperativeName: string;
  totalRequests: number;
  pending: number;
  granted: number;
  denied: number;
  revoked: number;
  renewed: number;
}

/** US-089: One row per GRANTED certification for the ONSSA report. */
export interface OnssaCertRow {
  certificationNumber: string | null;
  cooperativeName: string;
  productTypeCode: string;
  regionCode: string;
  certificationType: string;
  grantedAt: Date | null;
  validFrom: string | null;
  validUntil: string | null;
}

/** US-082: Analytics breakdown by region. */
export interface RegionAnalyticsRow {
  region: string;
  granted: number;
  denied: number;
  revoked: number;
  total: number;
}

/** US-082: Analytics breakdown by product type. */
export interface ProductTypeAnalyticsRow {
  productType: string;
  granted: number;
  denied: number;
  revoked: number;
  total: number;
}

/** US-082: Full analytics response. */
export interface CertificationAnalytics {
  period: { from: string | null; to: string | null };
  byRegion: RegionAnalyticsRow[];
  byProductType: ProductTypeAnalyticsRow[];
  generatedAt: string;
}
