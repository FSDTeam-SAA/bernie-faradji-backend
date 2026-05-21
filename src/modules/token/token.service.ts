import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Token, TokenDocument } from './schemas/token.schema';
import { Winner, WinnerDocument } from './schemas/winner.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Prize, PrizeDocument } from '../prize/schemas/prize.schema';
import {
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
  @InjectModel(Token.name) private readonly tokenModel: Model<TokenDocument>,
  @InjectModel(Winner.name)
  private readonly winnerModel: Model<WinnerDocument>,
  @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  @InjectModel(Prize.name) private readonly prizeModel: Model<PrizeDocument>,
  private readonly configService: ConfigService,
) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
    );
  }

  // ─── User: Create Stripe Checkout for Tokens ──────────
  async buyTokens(userId: string, dto: BuyTokenDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const totalPrice = dto.quantity * TOKEN_PRICE;
    const priceInCents = Math.round(totalPrice * 100);

    // create pending token record
    const token = await this.tokenModel.create({
      userId,
      vehicleNumber: dto.vehicleNumber,
      quantity: dto.quantity,
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
              name: `BubbleDrive Tokens x${dto.quantity}`,
              description: `Vehicle: ${dto.vehicleNumber}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        tokenId: token._id.toString(),
        vehicleNumber: dto.vehicleNumber,
        quantity: dto.quantity.toString(),
      },
      success_url: `${this.configService.get('app.frontendUrl')}/token-success`,
      cancel_url: `${this.configService.get('app.frontendUrl')}/token-cancel`,
    });

    // save stripeSessionId on token record
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        `Webhook Error: ${message}`,
        HttpStatus.BAD_REQUEST,
      );
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

  // ─── User: My Tokens ──────────────────────────────────
  async getMyTokens(userId: string, query: GetTokensQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const filter: any = { userId, paymentStatus: 'PAID' };
    if (query.date) {
      const date = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total = await this.tokenModel.countDocuments(filter);
    const tokens = await this.tokenModel
      .find(filter)
      .select('quantity totalPrice vehicleNumber createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // attach hardcoded token price for frontend display
    const result = tokens.map((t) => ({
      ...t.toObject(),
      tokenPrice: TOKEN_PRICE,
    }));

 const winner = await this.winnerModel
  .findOne({ isActive: true })
  .populate('userId', 'name email')
  .populate('tokenId')
  .populate('prizeId', 'prizeTag isActive');

    return {
      message: 'Your tokens fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        winner: winner || null,
        tokens: result,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Admin: Get All Token Purchases ───────────────────
  async getAllTokens(query: GetTokensQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const filter: any = { paymentStatus: 'PAID' };

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const flexibleVehicleRegex = new RegExp(
        search
          .replace(/\s+/g, '')
          .split('')
          .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s*'),
        'i',
      );
      const numericSearch = Number(search);

      const matchedUsers = await this.userModel
        .find({ $or: [{ name: regex }, { email: regex }] })
        .select('_id')
        .limit(50);

      const userIds = matchedUsers.map((user) => user._id);
      const parsedDate = new Date(search);
      const isSearchDate = !Number.isNaN(parsedDate.getTime());
      const nextDay = new Date(parsedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filter.$or = [
        { vehicleNumber: regex },
        { vehicleNumber: flexibleVehicleRegex },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ...(!Number.isNaN(numericSearch)
          ? [{ quantity: numericSearch }, { totalPrice: numericSearch }]
          : []),
        ...(isSearchDate ? [{ createdAt: { $gte: parsedDate, $lt: nextDay } }] : []),
      ];
    }

    if (query.date) {
      const date = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total = await this.tokenModel.countDocuments(filter);
    const tokens = await this.tokenModel
      .find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Tokens fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        tokens,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Admin: Auto Select Winner ─────────────────────────
  async autoSelectWinner() {
    // get all PAID token records — each record = one entry in the pool
    const allTokens = await this.tokenModel
      .find({ paymentStatus: 'PAID' })
      .populate('userId', 'name email');

    if (!allTokens.length) {
      throw new HttpException('No token purchases found', HttpStatus.NOT_FOUND);
    }

    // random pick from all entries (more purchases = more chances)
    const randomIndex = Math.floor(Math.random() * allTokens.length);
    const winningToken = allTokens[randomIndex];

    return this.saveWinner(winningToken, 'AUTO');
  }

  // ─── Admin: Manual Select Winner ──────────────────────
  async manualSelectWinner(dto: SelectWinnerManualDto) {
    const token = await this.tokenModel
      .findOne({ _id: dto.tokenId, paymentStatus: 'PAID' })
      .populate('userId', 'name email');

    if (!token) {
      throw new HttpException('Token purchase not found', HttpStatus.NOT_FOUND);
    }

    return this.saveWinner(token, 'MANUAL');
  }

  // ─── Save Winner to DB ─────────────────────────────────
private async saveWinner(token: any, selectionType: 'AUTO' | 'MANUAL') {
  await this.winnerModel.updateMany({}, { isActive: false });

  const activePrize = await this.prizeModel.findOne({ isActive: true });

  const winner = await this.winnerModel.create({
    userId: token.userId._id || token.userId,
    tokenId: token._id,
    prizeId: activePrize?._id || null,
    vehicleNumber: token.vehicleNumber,
    selectionType,
    isActive: true,
  });

  const populated = await winner.populate([
    { path: 'userId', select: 'name email' },
    { path: 'tokenId' },
    { path: 'prizeId', select: 'prizeTag isActive' },
  ]);

  return {
    message: `Winner selected ${selectionType === 'AUTO' ? 'automatically' : 'manually'}`,
    data: populated,
  };
}

  // ─── Get Current Winner ────────────────────────────────
  async getCurrentWinner() {
    const winner = await this.winnerModel
      .findOne({ isActive: true })
      .populate('userId', 'name email')
      .populate('tokenId')
      .populate('prizeId', 'prizeTag isActive');

    return {
      message: winner ? 'Current winner fetched' : 'No winner selected yet',
      data: winner || null,
    };
  }

  // ─── Get Winner History ────────────────────────────────
  async getWinnerHistory(query: GetTokensQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const total = await this.winnerModel.countDocuments();
    const winners = await this.winnerModel
      .find()
      .populate('userId', 'name email')
      .populate('tokenId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Winner history fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        winners,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }
}
