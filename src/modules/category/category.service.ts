import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  GetCategoriesQueryDto,
} from './dto/category.dto';


@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── Create ────────────────────────────────────────────
  async create(
    dto: CreateCategoryDto,
    files: { [fieldname: string]: Express.Multer.File[] },
  ) {
    let iconUrl = '';

    const iconFile = files?.['icon']?.[0];
    if (iconFile) {
      const result = await this.cloudinaryService.upload(
        iconFile.path,
        `category-icon-${Date.now()}`,
        'category-icons',
      );
      iconUrl = result.url;
    }

    const category = await this.categoryModel.create({
      ...dto,
      icon: iconUrl,
    });

    return { message: 'Category created successfully', data: category };
  }

  // ─── Get All (paginated) ───────────────────────────────
  async getAll(query: GetCategoriesQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'name' });

    const total      = await this.categoryModel.countDocuments(filter);
    const categories = await this.categoryModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Categories fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        categories,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  // ─── Get Single ────────────────────────────────────────
  async getOne(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Category fetched successfully', data: category };
  }

  // ─── Update ────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateCategoryDto,
    files: { [fieldname: string]: Express.Multer.File[] },
  ) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    const iconFile = files?.['icon']?.[0];
    if (iconFile) {
      // delete old icon from Cloudinary
      if (category.icon) await this.cloudinaryService.delete(category.icon);

      const result = await this.cloudinaryService.upload(
        iconFile.path,
        `category-icon-${id}-${Date.now()}`,
        'category-icons',
      );
      (dto as any).icon = result.url;
    }

    const updated = await this.categoryModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });

    return { message: 'Category updated successfully', data: updated };
  }

  // ─── Delete ────────────────────────────────────────────
  async remove(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    if (category.icon) await this.cloudinaryService.delete(category.icon);

    await this.categoryModel.findByIdAndDelete(id);
    return { message: 'Category deleted successfully', data: null };
  }
}