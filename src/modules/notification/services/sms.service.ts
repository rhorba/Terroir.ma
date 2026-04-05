import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendSmsOptions {
  to: string; // +212XXXXXXXXX
  body: string;
}

/**
 * SMS delivery service.
 * In development, messages are only logged (no real SMS gateway configured).
 * In production, wire to a Moroccan SMS gateway (e.g., Bulk SMS MA, OVH SMS).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('NODE_ENV') === 'production';
  }

  async send(opts: SendSmsOptions): Promise<void> {
    if (!this.enabled) {
      this.logger.log({ to: opts.to, body: opts.body }, '[DEV] SMS not sent — dev mode');
      return;
    }

    // TODO(Phase 2): Integrate production SMS gateway here.
    // Required env vars: SMS_GATEWAY_URL, SMS_API_KEY, SMS_SENDER_ID
    this.logger.warn({ to: opts.to }, 'SMS gateway not configured — message dropped');
  }
}
