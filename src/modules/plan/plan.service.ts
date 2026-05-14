import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';
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
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
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

    return {
      message: 'Plans fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        plans,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Get Single ────────────────────────────────────────
  async getOne(id: string) {
    const plan = await this.planModel.findById(id);
    if (!plan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Plan fetched successfully', data: plan };
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