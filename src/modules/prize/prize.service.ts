import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prize, PrizeDocument } from './schemas/prize.schema';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { CreatePrizeDto, UpdatePrizeDto, GetPrizesQueryDto } from './dto/prize.dto';

@Injectable()
export class PrizeService {
  constructor(
    @InjectModel(Prize.name)
    private readonly prizeModel: Model<PrizeDocument>,
  ) {}

  // ─── Create ────────────────────────────────────────────
  async create(dto: CreatePrizeDto) {
    // new prize is inactive by default
    const prize = await this.prizeModel.create({ ...dto, isActive: false });
    return { message: 'Prize created successfully', data: prize };
  }

  // ─── Get All ───────────────────────────────────────────
  async getAll(query: GetPrizesQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'prizeTag' });

    const total  = await this.prizeModel.countDocuments(filter);
    const prizes = await this.prizeModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Prizes fetched successfully',
      meta: createMeta(page, limit, total),
      data: { prizes, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Get Single ────────────────────────────────────────
  async getOne(id: string) {
    const prize = await this.prizeModel.findById(id);
    if (!prize) throw new HttpException('Prize not found', HttpStatus.NOT_FOUND);
    return { message: 'Prize fetched successfully', data: prize };
  }

  // ─── Update ────────────────────────────────────────────
  async update(id: string, dto: UpdatePrizeDto) {
    // if trying to activate — deactivate all others first
    if (dto.isActive === true) {
      await this.prizeModel.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    const prize = await this.prizeModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });
    if (!prize) throw new HttpException('Prize not found', HttpStatus.NOT_FOUND);

    return { message: 'Prize updated successfully', data: prize };
  }

  // ─── Delete ────────────────────────────────────────────
  async remove(id: string) {
    const prize = await this.prizeModel.findById(id);
    if (!prize) throw new HttpException('Prize not found', HttpStatus.NOT_FOUND);

    if (prize.isActive) {
      throw new HttpException(
        'Cannot delete an active prize. Deactivate it first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prizeModel.findByIdAndDelete(id);
    return { message: 'Prize deleted successfully', data: null };
  }
}