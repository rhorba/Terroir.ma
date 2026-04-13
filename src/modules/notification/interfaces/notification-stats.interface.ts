export interface ChannelDeliveryStats {
  channel: 'email' | 'sms';
  sent: number;
  failed: number;
  deliveryRate: number; // 0–100 integer: Math.round(sent / (sent + failed) * 100)
}

export interface NotificationStats {
  total: number;
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
  byChannel: ChannelDeliveryStats[];
  from: string | null;
  to: string | null;
  generatedAt: string;
}
