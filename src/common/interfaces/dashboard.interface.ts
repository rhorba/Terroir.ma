export interface CooperativeMetrics {
  total: number;
  verified: number;
  pending: number;
  suspended: number;
}

export interface ProductMetrics {
  total: number;
}

export interface CertificationMetrics {
  total: number;
  granted: number;
  pending: number;
  denied: number;
  revoked: number;
}

export interface LabTestMetrics {
  total: number;
  passed: number;
  failed: number;
}

export interface NotificationMetrics {
  total: number;
  sent: number;
  failed: number;
}

export interface DashboardMetrics {
  cooperatives: CooperativeMetrics;
  products: ProductMetrics;
  certifications: CertificationMetrics;
  labTests: LabTestMetrics;
  notifications: NotificationMetrics;
  generatedAt: string;
}
