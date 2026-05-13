import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const port = this.configService.get<number>('email.port', 587);
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port,
      secure: port === 465,
      auth: {
        user: this.configService.get<string>('email.address'),
        pass: this.configService.get<string>('email.pass'),
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"App" <${this.configService.get<string>('email.from')}>`,
        to,
        subject: 'Password Reset OTP',
        html: this.otpTemplate(otp),
      });
    } catch (error) {
      this.logger.error('Failed to send OTP email', error);
      throw error;
    }
  }

  async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"App" <${this.configService.get<string>('email.from')}>`,
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw error;
    }
  }

  private otpTemplate(otp: string): string {
    return `
      <!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <style>
        body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
        .container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden}
        .header{background:#4f46e5;padding:24px;text-align:center}
        .header h1{color:#fff;margin:0;font-size:24px}
        .body{padding:32px;text-align:center}
        .otp{font-size:40px;font-weight:bold;color:#4f46e5;letter-spacing:8px;margin:24px 0}
        .footer{text-align:center;padding:16px;font-size:12px;color:#9ca3af}
      </style></head>
      <body><div class="container">
        <div class="header"><h1>Password Reset</h1></div>
        <div class="body">
          <p>Your OTP code is:</p>
          <div class="otp">${otp}</div>
          <p>This code expires in <strong>15 minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
        <div class="footer">© ${new Date().getFullYear()} Your App. All rights reserved.</div>
      </div></body></html>`;
  }
}
