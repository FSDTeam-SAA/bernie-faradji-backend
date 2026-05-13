

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RoleType } from '../../common/enums/role.enum';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  GetCategoriesQueryDto,
} from './dto/category.dto';

// ─── Multer disk storage (same pattern as boilerplate) ────
const multerStorage = diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/images';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ─── Public: Get All ──────────────────────────────────
  @Public()
  @Get()
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.categoryService.getAll(query);
  }

  // ─── Public: Get Single ───────────────────────────────
  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.categoryService.getOne(id);
  }

  // ─── Admin: Create ────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFiles() files: { icon?: Express.Multer.File[] },
  ) {
    return this.categoryService.create(dto, files as any);
  }

  // ─── Admin: Update ────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFiles() files: { icon?: Express.Multer.File[] },
  ) {
    return this.categoryService.update(id, dto, files as any);
  }

  // ─── Admin: Delete ────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}