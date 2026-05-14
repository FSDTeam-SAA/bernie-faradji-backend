import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Token, TokenDocument } from './schemas/token.schema';
import { Winner, WinnerDocument } from './schemas/winner.schema';
import { Prize, PrizeDocument } from '../prize/schemas/prize.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import {
  BuyTokenDto,
  SelectWinnerManualDto,
  GetTokensQueryDto,
  TOKEN_PRICE,
} from './dto/token.dto';

@Injectable()
export class TokenService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectModel(Token.name)  private readonly tokenModel:  Model<TokenDocument>,
    @InjectModel(Winner.name) private readonly winnerModel: Model<WinnerDocument>,
    @InjectModel(Prize.name)  private readonly prizeModel:  Model<PrizeDocument>,
    @InjectModel(User.name)   private readonly userModel:   Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'));
  }

  // ─── User: Create Stripe Checkout for Tokens ──────────
  async buyTokens(userId: string, dto: BuyTokenDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const totalPrice   = dto.quantity * TOKEN_PRICE;
    const priceInCents = Math.round(totalPrice * 100);

    const token = await this.tokenModel.create({
      userId,
      vehicleNumber: dto.vehicleNumber,
      quantity:      dto.quantity,
      totalPrice,
      paymentStatus: 'PENDING',
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name:        `BubbleDrive Tokens x${dto.quantity}`,
              description: `Vehicle: ${dto.vehicleNumber}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId:        userId.toString(),
        tokenId:       token._id.toString(),
        vehicleNumber: dto.vehicleNumber,
        quantity:      dto.quantity.toString(),
      },
      success_url: `${this.configService.get('app.frontendUrl')}/token-success`,
      cancel_url:  `${this.configService.get('app.frontendUrl')}/token-cancel`,
    });

    await this.tokenModel.findByIdAndUpdate(token._id, {
      stripeSessionId: session.id,
    });

    return { message: 'Checkout session created', data: { url: session.url } };
  }

  // ─── Stripe Webhook Handler ────────────────────────────
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET_TOKEN'),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Webhook Error: ${message}`, HttpStatus.BAD_REQUEST);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      await this.tokenModel.findOneAndUpdate(
        { stripeSessionId: session.id },
        { paymentStatus: 'PAID' },
      );
    }

    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      const session = event.data.object as any;
      await this.tokenModel.findOneAndUpdate(
        { stripeSessionId: session.id },
        { paymentStatus: 'FAILED' },
      );
    }

    return { received: true };
  }

  // ─── Admin: Get All Token Purchases ───────────────────
  async getAllTokens(query: GetTokensQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);

    const filter: any = { paymentStatus: 'PAID' };
    if (query.date) {
      const date    = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total  = await this.tokenModel.countDocuments(filter);
    const tokens = await this.tokenModel
      .find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Tokens fetched successfully',
      meta: createMeta(page, limit, total),
      data: { tokens, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Admin: Auto Select Winner ─────────────────────────
  async autoSelectWinner() {
    const allTokens = await this.tokenModel
      .find({ paymentStatus: 'PAID' })
      .populate('userId', 'name email phone profileImage');

    if (!allTokens.length) {
      throw new HttpException('No token purchases found', HttpStatus.NOT_FOUND);
    }

    const randomIndex  = Math.floor(Math.random() * allTokens.length);
    const winningToken = allTokens[randomIndex];

    return this.saveWinner(winningToken, 'AUTO');
  }

  // ─── Admin: Manual Select Winner ──────────────────────
  async manualSelectWinner(dto: SelectWinnerManualDto) {
    const token = await this.tokenModel
      .findOne({ _id: dto.tokenId, paymentStatus: 'PAID' })
      .populate('userId', 'name email phone profileImage');

    if (!token) {
      throw new HttpException('Token purchase not found', HttpStatus.NOT_FOUND);
    }

    return this.saveWinner(token, 'MANUAL');
  }

  // ─── Save Winner (with active prize) ──────────────────
  private async saveWinner(token: any, selectionType: 'AUTO' | 'MANUAL') {
    // get currently active prize — required before selecting winner
    const activePrize = await this.prizeModel.findOne({ isActive: true });
    if (!activePrize) {
      throw new HttpException(
        'No active prize found. Please activate a prize before selecting a winner.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // deactivate previous winner
    await this.winnerModel.updateMany({}, { isActive: false });

    const winner = await this.winnerModel.create({
      userId:        token.userId._id || token.userId,
      tokenId:       token._id,
      prizeId:       activePrize._id,
      vehicleNumber: token.vehicleNumber,
      selectionType,
      isActive:      true,
    });

    // populate all — user + token + prize
    const populated = await this.winnerModel
      .findById(winner._id)
      .populate('userId',  'name email phone profileImage')
      .populate('tokenId', 'quantity totalPrice vehicleNumber createdAt')
      .populate('prizeId', 'prizeTag');

    return {
      message: `Winner selected ${selectionType === 'AUTO' ? 'automatically' : 'manually'}`,
      data: populated,
    };
  }

  // ─── Get Current Winner ────────────────────────────────
  async getCurrentWinner() {
    const winner = await this.winnerModel
      .findOne({ isActive: true })
      .populate('userId',  'name email phone profileImage')
      .populate('tokenId', 'quantity totalPrice vehicleNumber createdAt')
      .populate('prizeId', 'prizeTag');

    return {
      message: winner ? 'Current winner fetched' : 'No winner selected yet',
      data: winner || null,
    };
  }

  // ─── Get Winner History ────────────────────────────────
  async getWinnerHistory(query: GetTokensQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);

    const total   = await this.winnerModel.countDocuments();
    const winners = await this.winnerModel
      .find()
      .populate('userId',  'name email phone profileImage')
      .populate('tokenId', 'quantity totalPrice vehicleNumber createdAt')
      .populate('prizeId', 'prizeTag')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Winner history fetched successfully',
      meta: createMeta(page, limit, total),
      data: { winners, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }
}