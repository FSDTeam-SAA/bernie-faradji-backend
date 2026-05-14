import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Insurance, InsuranceDocument } from './schemas/insurance.schema';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import {
  CreateInsuranceDto,
  UpdateInsuranceDto,
  GetInsuranceQueryDto,
} from './dto/insurance.dto';

@Injectable()
export class InsuranceService {
  constructor(
    @InjectModel(Insurance.name)
    private readonly insuranceModel: Model<InsuranceDocument>,
  ) {}

  // ─── Create ────────────────────────────────────────────
  async create(dto: CreateInsuranceDto) {
    const insurance = await this.insuranceModel.create(dto);
    return { message: 'Insurance created successfully', data: insurance };
  }

  // ─── Get All (paginated) ───────────────────────────────
  async getAll(query: GetInsuranceQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'name' });

    const total      = await this.insuranceModel.countDocuments(filter);
    const insurances = await this.insuranceModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Insurances fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        insurances,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Get Single ────────────────────────────────────────
  async getOne(id: string) {
    const insurance = await this.insuranceModel.findById(id);
    if (!insurance) {
      throw new HttpException('Insurance not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Insurance fetched successfully', data: insurance };
  }

  // ─── Update ────────────────────────────────────────────
  async update(id: string, dto: UpdateInsuranceDto) {
    const insurance = await this.insuranceModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });
    if (!insurance) {
      throw new HttpException('Insurance not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Insurance updated successfully', data: insurance };
  }

  // ─── Delete ────────────────────────────────────────────
  async remove(id: string) {
    const insurance = await this.insuranceModel.findByIdAndDelete(id);
    if (!insurance) {
      throw new HttpException('Insurance not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Insurance deleted successfully', data: null };
  }
}