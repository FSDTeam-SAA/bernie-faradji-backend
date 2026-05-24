import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Journey, JourneyDocument } from './schemas/journey.schema';
import { Settings, SettingsDocument } from './schemas/settings.schema';
import { Category, CategoryDocument } from '../category/schemas/category.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { BuyJourneyPassDto, UpdateLateFeeDto, GetJourneysQueryDto } from './dto/journey.dto';

@Injectable()
export class JourneyService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectModel(Journey.name)   private readonly journeyModel:  Model<JourneyDocument>,
    @InjectModel(Settings.name)  private readonly settingsModel: Model<SettingsDocument>,
    @InjectModel(Category.name)  private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name)      private readonly userModel:     Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  // ─── Check Late Fee Logic ──────────────────────────────
  // late fee applies if preferredDate is today or tomorrow (within 1 day from now)
  private isLateFeeApplicable(preferredDate: Date): boolean {
    const today     = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff    = new Date(today);
    cutoff.setDate(cutoff.getDate() + 1); // today + 1 day

    const preferred = new Date(preferredDate);
    preferred.setHours(0, 0, 0, 0);

    return preferred <= cutoff;
  }

  // ─── Get Current Settings (late fee) ──────────────────
  async getSettings() {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      // auto-create with default 0 if not exists
      settings = await this.settingsModel.create({ lateFee: 0 });
    }
    return { message: 'Settings fetched successfully', data: settings };
  }

  // ─── Admin: Update Late Fee ────────────────────────────
  async updateLateFee(dto: UpdateLateFeeDto) {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create({ lateFee: dto.lateFee });
    } else {
      settings.lateFee = dto.lateFee;
      await settings.save();
    }
    return { message: 'Late fee updated successfully', data: settings };
  }

  // ─── User: Buy Journey Pass → Stripe Checkout ─────────
  async buyPass(userId: string, dto: BuyJourneyPassDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const category = await this.categoryModel.findById(dto.categoryId);
    if (!category) throw new HttpException('Category not found', HttpStatus.NOT_FOUND);

    const settings      = await this.settingsModel.findOne();
    const lateFeeAmount = settings?.lateFee || 0;

    const applyLateFee  = this.isLateFeeApplicable(new Date(dto.preferredDate));
    const lateFee       = applyLateFee ? lateFeeAmount : 0;
    const categoryPrice = category.rateDiscounted > 0 ? category.rateDiscounted : category.rateActual;
    const totalPrice    = categoryPrice + lateFee;
    const priceInCents  = Math.round(totalPrice * 100);

    // create pending journey record
    const journey = await this.journeyModel.create({
      userId,
      categoryId:       dto.categoryId,
      vehicleNumber:    dto.vehicleNumber,
      preferredDate:    new Date(dto.preferredDate),
      categoryPrice,
      lateFee,
      totalPrice,
      isLateFeeApplied: applyLateFee,
      paymentStatus:    'PENDING',
    });

    const lineItems: any[] = [
      {
        price_data: {
          currency:     'gbp',
          product_data: { name: category.name, description: dto.vehicleNumber },
          unit_amount:  Math.round(categoryPrice * 100),
        },
        quantity: 1,
      },
    ];

    // add late fee as a separate line item if applicable
    if (applyLateFee && lateFee > 0) {
      lineItems.push({
        price_data: {
          currency:     'gbp',
          product_data: { name: 'Late Booking Fee' },
          unit_amount:  Math.round(lateFee * 100),
        },
        quantity: 1,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      customer_email:       user.email,
      line_items:           lineItems,
      metadata: {
        userId:    userId.toString(),
        journeyId: journey._id.toString(),
      },
      success_url: `${this.configService.get('app.frontendUrl')}/payment-success`,
      cancel_url:  `${this.configService.get('app.frontendUrl')}/payment-cancel`,
    });

    await this.journeyModel.findByIdAndUpdate(journey._id, {
      stripeSessionId: session.id,
    });

    return { message: 'Checkout session created', data: { url: session.url } };
  }

  // ─── Stripe Webhook ────────────────────────────────────
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET_JOURNEY,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Webhook Error: ${message}`, HttpStatus.BAD_REQUEST);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      await this.journeyModel.findOneAndUpdate(
        { stripeSessionId: session.id },
        { paymentStatus: 'PAID' },
      );
    }

    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      const session = event.data.object as any;
      await this.journeyModel.findOneAndUpdate(
        { stripeSessionId: session.id },
        { paymentStatus: 'FAILED' },
      );
    }

    return { received: true };
  }

  // ─── Admin: Get Single Journey ────────────────────────
  async getOne(id: string) {
    const journey = await this.journeyModel
      .findById(id)
      .populate('userId',     'name email')
      .populate('categoryId', 'name icon rateActual rateDiscounted');
    if (!journey) throw new HttpException('Journey not found', HttpStatus.NOT_FOUND);
    return { message: 'Journey fetched successfully', data: journey };
  }

  // ─── Admin: Update Journey Status ─────────────────────
  async updateStatus(id: string, status: string) {
    const allowed = ['PENDING', 'CLEARED'];
    if (!allowed.includes(status)) {
      throw new HttpException(`Status must be one of: ${allowed.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    const journey = await this.journeyModel.findByIdAndUpdate(
      id,
      { journeyStatus: status },
      { new: true },
    ).populate('userId', 'name email')
     .populate('categoryId', 'name');
    if (!journey) throw new HttpException('Journey not found', HttpStatus.NOT_FOUND);
    return { message: 'Journey status updated successfully', data: journey };
  }

  // ─── Admin: Get All Journeys ───────────────────────────
  async getAllJourneys(query: GetJourneysQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);

    const filter: any = { paymentStatus: 'PAID' };

    if (query.status && query.status.trim()) {
      const status = query.status.trim().toUpperCase();
      if (status !== 'ALL') {
        filter.journeyStatus = status;
      }
    }

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

      const matchedCategories = await this.categoryModel
        .find({ name: regex })
        .select('_id')
        .limit(50);

      const matchedUsers = await this.userModel
        .find({ $or: [{ name: regex }, { email: regex }] })
        .select('_id')
        .limit(50);

      const categoryIds = matchedCategories.map((c) => c._id);
      const userIds = matchedUsers.map((user) => user._id);
      const parsedDate = new Date(search);
      const isSearchDate = !Number.isNaN(parsedDate.getTime());
      const nextDay = new Date(parsedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filter.$or = [
        { vehicleNumber: regex },
        { vehicleNumber: flexibleVehicleRegex },
        ...(categoryIds.length ? [{ categoryId: { $in: categoryIds } }] : []),
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ...(isSearchDate ? [{ preferredDate: { $gte: parsedDate, $lt: nextDay } }] : []),
      ];
    }

    if (query.date) {
      const date    = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total    = await this.journeyModel.countDocuments(filter);
    const journeys = await this.journeyModel
      .find(filter)
      .populate('userId',     'name email')
      .populate('categoryId', 'name icon rateActual rateDiscounted')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Journeys fetched successfully',
      meta: createMeta(page, limit, total),
      data: { journeys, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── User: My Journeys ────────────────────────────────
  async getMyJourneys(userId: string, query: GetJourneysQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);

    const filter: any = { userId, paymentStatus: 'PAID' };

    if (query.status && query.status.trim()) {
      const status = query.status.trim().toUpperCase();
      if (status !== 'ALL') {
        filter.journeyStatus = status;
      }
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const matchedCategories = await this.categoryModel
        .find({ name: regex })
        .select('_id')
        .limit(50);

      const categoryIds = matchedCategories.map((c) => c._id);

      filter.$or = [{ vehicleNumber: regex }];
      if (categoryIds.length) {
        filter.$or.push({ categoryId: { $in: categoryIds } });
      }
    }

    if (query.date) {
      const date    = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total    = await this.journeyModel.countDocuments(filter);
    const journeys = await this.journeyModel
      .find(filter)
      .populate('categoryId', 'name icon rateActual rateDiscounted')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Your journeys fetched successfully',
      meta: createMeta(page, limit, total),
      data: { journeys, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }
}
