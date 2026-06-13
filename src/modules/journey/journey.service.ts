import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Journey, JourneyDocument } from './schemas/journey.schema';
import { Settings, SettingsDocument } from './schemas/settings.schema';
import {
  Category,
  CategoryDocument,
} from '../category/schemas/category.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { EmailService } from '../../infrastructure/email/email.service';
import {
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import {
  BuyJourneyPassDto,
  UpdateLateFeeDto,
  GetJourneysQueryDto,
} from './dto/journey.dto';

@Injectable()
export class JourneyService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument>,
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  // ─── Check Late Fee Logic ──────────────────────────────
  private isLateFeeApplicable(preferredDate: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const preferred = new Date(preferredDate);
    preferred.setHours(0, 0, 0, 0);

    return preferred < today; // only past dates get late fee
  }

  // ─── Get Current Settings (late fee) ──────────────────
  async getSettings() {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
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
    const basePrice     = category.rateDiscounted > 0 ? category.rateDiscounted : category.rateActual;
    const journeyType   = dto.journeyType || 'one-way';
 
    // calculate category price based on journey type
    let categoryPrice: number;
    if (journeyType === 'return') {
      categoryPrice = (category as any).returnPrice > 0
        ? (category as any).returnPrice
        : basePrice * 2;
    } else {
      categoryPrice = basePrice;
    }
 
    const totalPrice    = categoryPrice + lateFee;
    const priceInCents  = Math.round(totalPrice * 100);
 
    const journey = await this.journeyModel.create({
      userId,
      categoryId:       dto.categoryId,
      vehicleNumber:    dto.vehicleNumber,
      preferredDate:    new Date(dto.preferredDate),
      subOption:        dto.subOption || null,
      journeyType,
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
          product_data: {
            name:        `${category.name} (${journeyType === 'return' ? 'Return' : 'One-Way'})`,
            description: dto.subOption
              ? `${dto.vehicleNumber} — ${dto.subOption}`
              : dto.vehicleNumber,
          },
          unit_amount:  Math.round(categoryPrice * 100),
        },
        quantity: 1,
      },
    ];
 
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
      throw new HttpException(
        `Webhook Error: ${message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const journey = await this.journeyModel
        .findOneAndUpdate(
          { stripeSessionId: session.id },
          { paymentStatus: 'PAID' },
          { new: true },
        )
        .populate('categoryId', 'name');

      // send confirmation email
      try {
        if (journey) {
          const user = await this.userModel.findById(journey.userId);
          if (user?.email) {
            await this.emailService.sendEmail({
              to: user.email,
              subject: 'Your Journey Pass is Confirmed!',
              html: this.buildJourneyEmail(user, journey),
            });
          }
        }
      } catch (emailError) {
        console.error('Journey confirmation email failed:', emailError);
      }
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
      .populate('userId', 'name email')
      .populate('categoryId', 'name icon rateActual rateDiscounted');
    if (!journey)
      throw new HttpException('Journey not found', HttpStatus.NOT_FOUND);
    return { message: 'Journey fetched successfully', data: journey };
  }

  // ─── Admin: Update Journey Status ─────────────────────
  async updateStatus(id: string, status: string) {
    const allowed = ['PENDING', 'CLEARED'];
    if (!allowed.includes(status)) {
      throw new HttpException(
        `Status must be one of: ${allowed.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const journey = await this.journeyModel
      .findByIdAndUpdate(id, { journeyStatus: status }, { new: true })
      .populate('userId', 'name email')
      .populate('categoryId', 'name');
    if (!journey)
      throw new HttpException('Journey not found', HttpStatus.NOT_FOUND);
    return { message: 'Journey status updated successfully', data: journey };
  }

  // ─── Admin: Get All Journeys ───────────────────────────
  async getAllJourneys(query: GetJourneysQueryDto) {
    const page = Number(query.page || 1);
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
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
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
        ...(isSearchDate
          ? [{ preferredDate: { $gte: parsedDate, $lt: nextDay } }]
          : []),
      ];
    }

    if (query.date) {
      const date = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total = await this.journeyModel.countDocuments(filter);
    const journeys = await this.journeyModel
      .find(filter)
      .populate('userId', 'name email')
      .populate('categoryId', 'name icon rateActual rateDiscounted')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Journeys fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        journeys,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── User: My Journeys ────────────────────────────────
  async getMyJourneys(userId: string, query: GetJourneysQueryDto) {
    const page = Number(query.page || 1);
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
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );

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
      const date = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: date, $lt: nextDay };
    }

    const total = await this.journeyModel.countDocuments(filter);
    const journeys = await this.journeyModel
      .find(filter)
      .populate('categoryId', 'name icon rateActual rateDiscounted')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Your journeys fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        journeys,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

 
  // ─── Journey Confirmation Email Template ──────────────
  private buildJourneyEmail(user: any, journey: any): string {
    const category = journey.categoryId as any;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Journey Pass Confirmed! 🚗</h2>
        <p>Hi <strong>${user.name || 'there'}</strong>,</p>
        <p>Your journey pass has been successfully confirmed. Here are your details:</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Journey Type</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${category?.name || 'N/A'}</td>
          </tr>
          ${journey.subOption ? `
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Route</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${journey.subOption}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Trip Type</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${journey.journeyType === 'return' ? 'Return' : 'One-Way'}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Vehicle Number</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${journey.vehicleNumber}</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Preferred Date</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${new Date(journey.preferredDate).toDateString()}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Journey Price</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">£${journey.categoryPrice}</td>
          </tr>
          ${journey.isLateFeeApplied ? `
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Late Fee</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">£${journey.lateFee}</td>
          </tr>` : ''}
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Total Paid</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">£${journey.totalPrice}</td>
          </tr>
        </table>
        <p>Thank you for choosing BubbleDrive!</p>
      </div>
    `;
  }
}