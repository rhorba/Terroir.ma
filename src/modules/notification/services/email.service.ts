import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly defaultFrom: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: false, // Mailpit dev SMTP — no TLS
    });

    this.defaultFrom = this.config.get<string>('SMTP_FROM', 'Terroir.ma <noreply@terroir.ma>');
  }

  async send(opts: SendEmailOptions): Promise<void> {
    const info = await this.transporter.sendMail({
      from: opts.from ?? this.defaultFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    this.logger.log({ messageId: info.messageId, to: opts.to }, 'Email sent');
  }
}
