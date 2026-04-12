export interface NotificationStats {
  total: number;
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
  from: string | null;
  to: string | null;
  generatedAt: string;
}
