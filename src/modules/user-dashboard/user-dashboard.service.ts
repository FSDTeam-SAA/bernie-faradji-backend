import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Journey, JourneyDocument } from '../journey/schemas/journey.schema';
import { Token, TokenDocument } from '../token/schemas/token.schema';

@Injectable()
export class UserDashboardService {
  constructor(
    @InjectModel(Journey.name) private readonly journeyModel: Model<JourneyDocument>,
    @InjectModel(Token.name)   private readonly tokenModel:   Model<TokenDocument>,
  ) {}

  // ─── User: Dashboard Stats ────────────────────────────
  async getStats(userId: string) {
    const objectId = new Types.ObjectId(userId);

    const [totalTokens, totalJourneys] = await Promise.all([
      this.tokenModel.aggregate([
        { $match: { userId: objectId, paymentStatus: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
      this.journeyModel.countDocuments({ userId, paymentStatus: 'PAID' }),
    ]);

    return {
      message: 'Dashboard stats fetched successfully',
      data: {
        totalTokens:   totalTokens[0]?.total || 0,
        totalJourneys,
      },
    };
  }
}