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
