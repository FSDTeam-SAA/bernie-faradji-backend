import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Plan, PlanDocument } from '../plan/schemas/plan.schema';
import { EmailService } from '../../infrastructure/email/email.service';
import { MembershipService } from '../membership/membership.service';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { GetSubscriptionsQueryDto } from './dto/subscription.dto';


@Injectable()
export class SubscriptionService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly membershipService: MembershipService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
    );
  }

  // ─── Create Stripe Checkout Session ───────────────────
  async createCheckout(userId: string, planId: string) {
    const plan = await this.planModel.findById(planId);
    if (!plan) throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);

    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const priceInCents = Math.round(plan.price * 100);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.title || plan.planName,
              description: plan.billingCycle.toUpperCase(),
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        billingCycle: plan.billingCycle,
      },
      success_url: `${this.configService.get('app.frontendUrl')}/subscription-success`,
      cancel_url: `${this.configService.get('app.frontendUrl')}/subscription-cancel`,
    });

    return { message: 'Checkout session created', data: { url: session.url } };
  }

  // ─── Handle Stripe Webhook ─────────────────────────────
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
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

      const userId      = session.metadata.userId;
      const planId      = session.metadata.planId;
      const billingCycle = session.metadata.billingCycle;

      const plan = await this.planModel.findById(planId);
      if (!plan) throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);

      const user = await this.userModel.findById(userId);
      if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

      // ── Calculate subscription dates ──
      const startDate = new Date();
      let endDate: Date | null = null;

      if (billingCycle?.toLowerCase() === 'monthly') {
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
      }

      if (billingCycle?.toLowerCase() === 'yearly') {
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // ── Update user subscription ──
      (user as any).subscription = {
        planId: plan._id,
        startDate,
        endDate,
      };

      user.hasActiveSubscription  = true;
      user.subscriptionExpireDate = endDate;

      await user.save();

      // ── Create membership record ──
      await this.membershipService.createFromWebhook(userId, planId, startDate, endDate);

      // ── Send confirmation email ──
      try {
        if (user.email) {
          await this.emailService.sendEmail({
            to: user.email,
            subject: 'Your subscription is confirmed!',
            html: this.buildSubscriptionEmail(user, plan, billingCycle, startDate, endDate),
          });
        }
      } catch (emailError) {
        console.error('Subscription confirmation email failed:', emailError);
      }
    }

    return { received: true };
  }

  // ─── Admin: Get All Subscribed Users ──────────────────
  async getAllSubscriptions(query: GetSubscriptionsQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = {
      ...createFilter(query.search, query.date, { searchField: 'name' }),
      hasActiveSubscription: true,
    };

    const total = await this.userModel.countDocuments(filter);
    const users = await this.userModel
      .find(filter)
      .select('-password -refreshToken -__v')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Subscriptions fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        subscriptions: users,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Email Template ───────────────────────────────────
  private buildSubscriptionEmail(
    user: any,
    plan: any,
    billingCycle: string,
    startDate: Date,
    endDate: Date | null,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Subscription Confirmed!</h2>
        <p>Hi <strong>${user.name || 'there'}</strong>,</p>
        <p>Your subscription has been successfully activated.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Plan</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${plan.planName}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Billing Cycle</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${billingCycle}</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Price</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">$${plan.price}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Start Date</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${startDate.toDateString()}</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Expiry Date</strong></td>
            <td style="padding:10px; border:1px solid #e5e7eb;">${endDate ? endDate.toDateString() : 'Lifetime'}</td>
          </tr>
        </table>
        <p>Thank you for subscribing!</p>
      </div>
    `;
  }
}