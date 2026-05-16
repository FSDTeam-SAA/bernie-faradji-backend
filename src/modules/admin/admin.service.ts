import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Journey, JourneyDocument } from '../journey/schemas/journey.schema';
import { Token, TokenDocument } from '../token/schemas/token.schema';
import { createMeta, createPaginationInfo } from '../../common/utils/pagination.util';
import { GetTransactionsQueryDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Journey.name) private readonly journeyModel: Model<JourneyDocument>,
    @InjectModel(Token.name)   private readonly tokenModel:   Model<TokenDocument>,
  ) {}

  // ─── Get All Transactions (journey + token merged) ────
  async getAllTransactions(query: GetTransactionsQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);

    const dateFilter: any = {};
    if (query.date) {
      const date    = new Date(query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      dateFilter.createdAt = { $gte: date, $lt: nextDay };
    }

    // ── Journey transactions ──
    const journeyTxns = await this.journeyModel.aggregate([
      { $match: { paymentStatus: 'PAID', ...dateFilter } },
      {
        $lookup: {
          from: 'users', localField: 'userId', foreignField: '_id', as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          buyerName:     '$user.name',
          email:         '$user.email',
          vehicleNumber: '$vehicleNumber',
          totalAmount:   '$totalPrice',
          purchaseDate:  '$createdAt',
          serviceType:   { $literal: 'JOURNEY' },
          serviceName:   '$category.name',
          journeyStatus: '$journeyStatus',
          paymentStatus: '$paymentStatus',
        },
      },
    ]);

    // ── Token transactions ──
    const tokenTxns = await this.tokenModel.aggregate([
      { $match: { paymentStatus: 'PAID', ...dateFilter } },
      {
        $lookup: {
          from: 'users', localField: 'userId', foreignField: '_id', as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          buyerName:     '$user.name',
          email:         '$user.email',
          vehicleNumber: '$vehicleNumber',
          totalAmount:   '$totalPrice',
          purchaseDate:  '$createdAt',
          serviceType:   { $literal: 'TOKEN' },
          serviceName:   { $concat: ['Token x', { $toString: '$quantity' }] },
          paymentStatus: '$paymentStatus',
        },
      },
    ]);

    // ── Merge + sort by date ──
    const all = [...journeyTxns, ...tokenTxns].sort(
      (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
    );

    const total     = all.length;
    const paginated = all.slice((page - 1) * limit, page * limit);

    return {
      message: 'Transactions fetched successfully',
      meta: createMeta(page, limit, total),
      data: { transactions: paginated, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Get Single Transaction ────────────────────────────
  async getOneTransaction(id: string, type: string) {
    if (!['journey', 'token'].includes(type?.toLowerCase())) {
      throw new HttpException('Type must be "journey" or "token"', HttpStatus.BAD_REQUEST);
    }

    const objectId = new Types.ObjectId(id);

    if (type.toLowerCase() === 'journey') {
      const journey = await this.journeyModel
        .findById(objectId)
        .populate('userId',     'name email')
        .populate('categoryId', 'name rateActual rateDiscounted');
      if (!journey) throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      return { message: 'Transaction fetched successfully', data: { ...journey.toObject(), serviceType: 'JOURNEY' } };
    }

    const token = await this.tokenModel
      .findById(objectId)
      .populate('userId', 'name email');
    if (!token) throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    return { message: 'Transaction fetched successfully', data: { ...token.toObject(), serviceType: 'TOKEN' } };
  }

  // ─── Dashboard Stats (cards) ───────────────────────────
  async getDashboardStats() {
    // total revenue = journey PAID + token PAID
    const journeyRevenue = await this.journeyModel.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);
    const tokenRevenue = await this.tokenModel.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);
    const totalRevenue =
      (journeyRevenue[0]?.total || 0) + (tokenRevenue[0]?.total || 0);

    // active journey users = unique users with PAID journeys
    const activeJourneyUsers = await this.journeyModel.distinct('userId', {
      paymentStatus: 'PAID',
    });

    // monthly token count = tokens bought this month
    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTokenCount = await this.tokenModel.countDocuments({
      paymentStatus: 'PAID',
      createdAt: { $gte: monthStart },
    });

    return {
      message: 'Dashboard stats fetched successfully',
      data: {
        totalRevenue,
        activeJourneyUsers: activeJourneyUsers.length,
        monthlyTokenCount,
      },
    };
  }

  // ─── Dashboard Charts (weekly earnings + category %) ──
  async getDashboardCharts(week?: string) {
    // ── Weekly Earnings ──
    const baseDate  = week ? new Date(week) : new Date();
    const day       = baseDate.getDay();
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const [journeyEarnings, tokenEarnings] = await Promise.all([
      this.journeyModel.aggregate([
        { $match: { paymentStatus: 'PAID', createdAt: { $gte: weekStart, $lt: weekEnd } } },
        { $group: { _id: { $dayOfWeek: '$createdAt' }, total: { $sum: '$totalPrice' } } },
      ]),
      this.tokenModel.aggregate([
        { $match: { paymentStatus: 'PAID', createdAt: { $gte: weekStart, $lt: weekEnd } } },
        { $group: { _id: { $dayOfWeek: '$createdAt' }, total: { $sum: '$totalPrice' } } },
      ]),
    ]);

    const earningsMap: Record<number, number> = {};
    journeyEarnings.forEach((e) => { earningsMap[e._id] = (earningsMap[e._id] || 0) + e.total; });
    tokenEarnings.forEach((e)   => { earningsMap[e._id] = (earningsMap[e._id] || 0) + e.total; });

    const weeklyData = days.map((d, i) => ({
      day:      d,
      earnings: earningsMap[i + 1] || 0,
    }));

    // ── Category Stats ──
    const total = await this.journeyModel.countDocuments({ paymentStatus: 'PAID' });

    const categoryBreakdown = await this.journeyModel.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'categories', localField: '_id', foreignField: '_id', as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryName: '$category.name',
          count:        1,
          percentage: {
            $round: [{ $multiply: [{ $divide: ['$count', total || 1] }, 100] }, 1],
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      message: 'Dashboard charts fetched successfully',
      data: {
        weeklyEarnings: { weekStart, weekEnd, weeklyData },
        categoryStats:  { total, categories: categoryBreakdown },
      },
    };
  }
}