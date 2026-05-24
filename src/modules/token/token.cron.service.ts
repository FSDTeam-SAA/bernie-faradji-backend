import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Token, TokenDocument } from './schemas/token.schema';

@Injectable()
export class TokenCronService {
  private readonly logger = new Logger(TokenCronService.name);

  constructor(
    @InjectModel(Token.name) private readonly tokenModel: Model<TokenDocument>,
  ) {}

  // ─── Runs at midnight on the 1st of every month ───────
  // Deletes previous month tokens to keep DB clean
  // Winners are already saved in winners collection with full snapshot
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupPreviousMonthTokens() {
    const now          = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    const result = await this.tokenModel.deleteMany({
      $or: [
        { month: { $lt: currentMonth }, year: currentYear },
        { year: { $lt: currentYear } },
      ],
    });

    this.logger.log(`Monthly cleanup: ${result.deletedCount} previous month tokens deleted`);
  }
}