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

  // ─── Auto expire check (called on get) ────────────────
  private async autoExpireCheck(membership: MembershipDocument) {
    if (
      membership.endDate &&
      new Date() > new Date(membership.endDate) &&
      membership.status !== 'EXPIRED'
    ) {
      membership.status = 'EXPIRED';
      await membership.save();
    }
    return membership;
  }

  // ─── Admin: Get All Memberships ───────────────────────
  async getAll(query: GetMembershipsQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'name' });

    // auto expire before returning
    await this.membershipModel.updateMany(
      { endDate: { $lt: new Date() }, status: { $nin: ['EXPIRED'] } },
      { status: 'EXPIRED' },
    );

    const total       = await this.membershipModel.countDocuments(filter);
    const memberships = await this.membershipModel
      .find(filter)
      .populate('userId', 'name email')
      .populate('planId', 'planName price billingCycle')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

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
    await this.autoExpireCheck(membership);
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
  async getMyMembership(userId: string) {
    // auto expire first
    await this.membershipModel.updateMany(
      { userId, endDate: { $lt: new Date() }, status: { $nin: ['EXPIRED'] } },
      { status: 'EXPIRED' },
    );

    const membership = await this.membershipModel
      .findOne({ userId })
      .populate('planId', 'planName price billingCycle packageIncludes')
      .sort({ createdAt: -1 });

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

    const membership = await this.membershipModel.create({
      userId,
      planId,
      startDate,
      endDate,
      status: 'PENDING',
    });

    return membership;
  }
}