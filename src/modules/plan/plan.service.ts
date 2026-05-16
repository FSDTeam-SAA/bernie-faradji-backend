import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import {
  CreatePlanDto,
  UpdatePlanDto,
  GetPlansQueryDto,
} from './dto/plan.dto';

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ─── Create ────────────────────────────────────────────
  async create(dto: CreatePlanDto) {
    const plan = await this.planModel.create(dto);
    return { message: 'Plan created successfully', data: plan };
  }

  // ─── Get All (paginated) ───────────────────────────────
  async getAll(query: GetPlansQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'planName' });

    const total = await this.planModel.countDocuments(filter);
    const plans = await this.planModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // attach subscriber count to each plan
    const plansWithSubscribers = await Promise.all(
      plans.map(async (plan) => {
        const subscribers = await this.userModel.countDocuments({
          'subscription.planId': plan._id,
          hasActiveSubscription: true,
        });
        return { ...plan.toObject(), subscribers };
      }),
    );

    return {
      message: 'Plans fetched successfully',
      meta: createMeta(page, limit, total),
      data: { plans: plansWithSubscribers, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Get Single ────────────────────────────────────────
  async getOne(id: string) {
    const plan = await this.planModel.findById(id);
    if (!plan) throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);

    const subscribers = await this.userModel.countDocuments({
      'subscription.planId': new Types.ObjectId(id),
      hasActiveSubscription: true,
    });

    return { message: 'Plan fetched successfully', data: { ...plan.toObject(), subscribers } };
  }

  // ─── Update ────────────────────────────────────────────
  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.planModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });
    if (!plan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Plan updated successfully', data: plan };
  }

  // ─── Delete ────────────────────────────────────────────
  async remove(id: string) {
    const plan = await this.planModel.findByIdAndDelete(id);
    if (!plan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Plan deleted successfully', data: null };
  }
}