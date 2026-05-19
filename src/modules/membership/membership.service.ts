import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership, MembershipDocument } from './schemas/membership.schema';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { UpdateMembershipStatusDto, GetMembershipsQueryDto } from './dto/membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
  ) {}

  // ─── Auto lifecycle status check (called on get) ──────
  private resolveStatus(
    startDate: Date,
    endDate: Date | null,
    currentStatus?: string,
  ): string {
    const now = new Date();

    if (endDate && now > new Date(endDate)) {
      return 'EXPIRED';
    }

    if (currentStatus === 'CLEARED') {
      return 'CLEARED';
    }

    if (now < new Date(startDate)) {
      return 'PENDING';
    }

    return 'ACTIVE';
  }

  private async syncMembershipStatus(membership: MembershipDocument) {
    const nextStatus = this.resolveStatus(
      membership.startDate,
      membership.endDate,
      membership.status,
    );

    if (membership.status !== nextStatus) {
      membership.status = nextStatus;
      await membership.save();
    }

    return membership;
  }

  // ─── Admin: Get All Memberships ───────────────────────
  async getAll(query: GetMembershipsQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'name' });

    const total       = await this.membershipModel.countDocuments(filter);
    const memberships = await this.membershipModel
      .find(filter)
      .populate('userId', 'name email')
      .populate('planId', 'planName price billingCycle')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    await Promise.all(
      memberships.map((membership) => this.syncMembershipStatus(membership)),
    );

    return {
      message: 'Memberships fetched successfully',
      meta: createMeta(page, limit, total),
      data: { memberships, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Admin: Get Single ────────────────────────────────
  async getOne(id: string) {
    const membership = await this.membershipModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('planId', 'planName price billingCycle');
    if (!membership) throw new HttpException('Membership not found', HttpStatus.NOT_FOUND);
    await this.syncMembershipStatus(membership);
    return { message: 'Membership fetched successfully', data: membership };
  }

  // ─── Admin: Update Status ─────────────────────────────
  async updateStatus(id: string, dto: UpdateMembershipStatusDto) {
    const membership = await this.membershipModel
      .findByIdAndUpdate(id, { status: dto.status }, { new: true })
      .populate('userId', 'name email')
      .populate('planId', 'planName price billingCycle');
    if (!membership) throw new HttpException('Membership not found', HttpStatus.NOT_FOUND);
    return { message: 'Membership status updated successfully', data: membership };
  }

  // ─── User: My Membership ──────────────────────────────
  async getMyMembership(userOrUserId: any) {
    const userId =
      userOrUserId?._id?.toString?.() ??
      userOrUserId?._id ??
      userOrUserId?.id ??
      userOrUserId;

    let membership = await this.membershipModel
      .findOne({ userId })
      .populate('planId', 'planName price billingCycle packageIncludes')
      .sort({ createdAt: -1 });

    // Back-compat: user marked as paid but membership record missing
    if (
      !membership &&
      userOrUserId &&
      typeof userOrUserId === 'object' &&
      userOrUserId.hasActiveSubscription &&
      userOrUserId.subscription?.planId
    ) {
      const startDate = userOrUserId.subscription?.startDate
        ? new Date(userOrUserId.subscription.startDate)
        : new Date();

      const endDate =
        userOrUserId.subscription?.endDate === null ||
        userOrUserId.subscription?.endDate === undefined
          ? null
          : new Date(userOrUserId.subscription.endDate);

      await this.membershipModel.create({
        userId,
        planId: userOrUserId.subscription.planId,
        startDate,
        endDate,
        paymentStatus: 'PAID',
        status: this.resolveStatus(startDate, endDate),
      });

      membership = await this.membershipModel
        .findOne({ userId })
        .populate('planId', 'planName price billingCycle packageIncludes')
        .sort({ createdAt: -1 });
    }

    if (membership) {
      await this.syncMembershipStatus(membership);
    }

    return {
      message: membership ? 'Membership fetched successfully' : 'No membership found',
      data: membership || null,
    };
  }

  // ─── Called from subscription webhook to create membership ──
  async createFromWebhook(
    userId: string,
    planId: string,
    startDate: Date,
    endDate: Date | null,
  ) {
    // deactivate old memberships
    await this.membershipModel.updateMany({ userId }, { status: 'EXPIRED' });
    const status = this.resolveStatus(startDate, endDate);

    const membership = await this.membershipModel.create({
      userId,
      planId,
      startDate,
      endDate,
      paymentStatus: 'PAID',
      status,
    });

    return membership;
  }
}
