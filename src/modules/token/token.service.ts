import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Token, TokenDocument } from './schemas/token.schema';
import { Winner, WinnerDocument } from './schemas/winner.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Prize, PrizeDocument } from '../prize/schemas/prize.schema';
import { EmailService } from '../../infrastructure/email/email.service';
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
    @InjectModel(User.name)   private readonly userModel:   Model<UserDocument>,
    @InjectModel(Prize.name)  private readonly prizeModel:  Model<PrizeDocument>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
    );
  }

  // ─── Generate Unique Ticket Codes ─────────────────────
  private async generateTicketCodes(quantity: number): Promise<string[]> {
    const codes: string[] = [];
    while (codes.length < quantity) {
      const code = 'BBD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      // ensure uniqueness across all tokens in DB
      const exists = await this.tokenModel.findOne({ ticketCodes: code });
      if (!exists && !codes.includes(code)) {
        codes.push(code);
      }
    }
    return codes;
  }

  // ─── User: Create Stripe Checkout for Tokens ──────────
  async buyTokens(userId: string, dto: BuyTokenDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const totalPrice = dto.quantity * TOKEN_PRICE;
    const priceInCents = Math.round(totalPrice * 100);

    const now = new Date();
    const token = await this.tokenModel.create({
      userId,
      vehicleNumber: dto.vehicleNumber,
      quantity:      dto.quantity,
      totalPrice,
      paymentStatus: 'PENDING',
      month:         now.getMonth() + 1,
      year:          now.getFullYear(),
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
      success_url: `${this.configService.get('app.frontendUrl')}/payment-success`,
      cancel_url: `${this.configService.get('app.frontendUrl')}/payment-cancel`,
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
      const tokenRecord = await this.tokenModel.findOne({ stripeSessionId: session.id });
      if (tokenRecord) {
        const ticketCodes = await this.generateTicketCodes(tokenRecord.quantity);
        await this.tokenModel.findByIdAndUpdate(tokenRecord._id, {
          paymentStatus: 'PAID',
          ticketCodes,
        });

        // send confirmation email
        try {
          const user = await this.userModel.findById(tokenRecord.userId);
          if (user?.email) {
            await this.emailService.sendEmail({
              to: user.email,
              subject: 'Your BubbleDrive Token Purchase is Confirmed!',
              html: this.buildTokenEmail(user, tokenRecord, ticketCodes),
            });
          }
        } catch (emailError) {
          console.error('Token purchase email failed:', emailError);
        }
      }
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
      .select('quantity totalPrice vehicleNumber ticketCodes createdAt')
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
      .populate('tokenId');

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

    // search by vehicle number or join user name/email via populate
    const now = new Date();
    const filter: any = {
      paymentStatus: 'PAID',
      month: now.getMonth() + 1,
      year:  now.getFullYear(),
    };
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
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    const allTokens = await this.tokenModel
      .find({ paymentStatus: 'PAID', month: currentMonth, year: currentYear })
      .populate('userId', 'name email');

    if (!allTokens.length) {
      throw new HttpException('No token purchases found for current month', HttpStatus.NOT_FOUND);
    }

    // random pick from all entries (more purchases = more chances)
    const randomIndex = Math.floor(Math.random() * allTokens.length);
    const winningToken = allTokens[randomIndex];

    return this.saveWinner(winningToken, 'AUTO');
  }

  // ─── Admin: Manual Select Winner ──────────────────────
  async manualSelectWinner(dto: SelectWinnerManualDto) {
    const now = new Date();
    const token = await this.tokenModel
      .findOne({ _id: dto.tokenId, paymentStatus: 'PAID', month: now.getMonth() + 1, year: now.getFullYear() })
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

    // pick a random winning code from the token's ticket codes
    const codes = token.ticketCodes || [];
    const winningCode = codes.length > 0
      ? codes[Math.floor(Math.random() * codes.length)]
      : null;

    const winner = await this.winnerModel.create({
      userId:        token.userId._id || token.userId,
      tokenId:       token._id,
      prizeId:       activePrize?._id || null,
      vehicleNumber: token.vehicleNumber,
      winningCode,
      selectionType,
      isActive:      true,
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
      .populate('tokenId');

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

  // ─── Token Purchase Email Template ───────────────────
  private buildTokenEmail(user: any, token: any, ticketCodes: string[]): string {
    const codesHtml = ticketCodes
      .map((code) => `<tr><td style="padding:8px 10px; border:1px solid #e5e7eb; font-family: monospace; font-size: 15px; color: #2563eb;">${code}</td></tr>`)
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Token Purchase Confirmed! 🎟️</h2>
        <p>Hi <strong>${user.name || 'there'}</strong>,</p>
        <p>Your token purchase has been successfully confirmed. Here are your token details:</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Vehicle Number</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${token.vehicleNumber}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Quantity</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${token.quantity} Token(s)</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Price Per Token</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">£${TOKEN_PRICE}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Total Paid</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">£${token.totalPrice}</td>
          </tr>
        </table>
        <h3 style="color: #2563eb;">Your Token Codes</h3>
        <p style="color: #6b7280;">Keep these safe — these are your unique token codes.</p>
        <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
          ${codesHtml}
        </table>
        <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">Thank you for your purchase!</p>
      </div>
    `;
  }
}