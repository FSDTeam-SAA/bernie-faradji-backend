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
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { GetUsersQueryDto, UpdateUserDto, AdminUpdateUserDto } from './dto/user.dto';

// ─── Multer Storage Config ───────────
const multerStorage = diskStorage({
  destination: (req, file, cb) => {
    const folder = file.mimetype === 'application/pdf' ? 'uploads/files' : 'uploads/images';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Admin Routes ──────────
  @Get('all-users')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  getAllUsers(@Query() query: GetUsersQueryDto) {
    return this.userService.getAllUsers(query);
  }

  @Get('all-admins')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  getAllAdmins(@Query() query: GetUsersQueryDto) {
    return this.userService.getAllAdmins(query);
  }

  // ─── Own Profile ───────────────
  @Get('me')
  getProfile(@CurrentUser('_id') userId: string) {
    return this.userService.getUserById(userId);
  }

  @Put('me')
  updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUser('_id') userId: string) {
    return this.userService.deleteUser(userId);
  }

  // ─── Single Avatar ──────────────
  @Post('upload-avatar')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'profileImage', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  createAvatar(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { profileImage?: Express.Multer.File[] },
  ) {
    if (!files?.profileImage?.length) {
      throw new BadRequestException('Profile image is required');
    }
    return this.userService.createAvatar(userId, files as any);
  }

  @Put('upload-avatar')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'profileImage', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  updateAvatar(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { profileImage?: Express.Multer.File[] },
  ) {
    if (!files?.profileImage?.length) {
      throw new BadRequestException('Profile image is required');
    }
    return this.userService.updateAvatar(userId, files as any);
  }

  @Delete('upload-avatar')
  @HttpCode(HttpStatus.OK)
  deleteAvatar(@CurrentUser('_id') userId: string) {
    return this.userService.deleteAvatar(userId);
  }

  // ─── Multiple Avatar ───────────────
  @Post('upload-multiple-avatar')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'multiProfileImage', maxCount: 5 }], {
      storage: multerStorage,
    }),
  )
  createMultipleAvatars(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { multiProfileImage?: Express.Multer.File[] },
  ) {
    if (!files?.multiProfileImage?.length) {
      throw new BadRequestException('At least one avatar image is required');
    }
    return this.userService.createMultipleAvatars(userId, files as any);
  }

  @Put('upload-multiple-avatar')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'multiProfileImage', maxCount: 5 }], {
      storage: multerStorage,
    }),
  )
  updateMultipleAvatars(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { multiProfileImage?: Express.Multer.File[] },
  ) {
    if (!files?.multiProfileImage?.length) {
      throw new BadRequestException('At least one avatar image is required');
    }
    return this.userService.updateMultipleAvatars(userId, files as any);
  }

  @Delete('upload-multiple-avatar')
  @HttpCode(HttpStatus.OK)
  deleteMultipleAvatars(@CurrentUser('_id') userId: string) {
    return this.userService.deleteMultipleAvatars(userId);
  }

  // ─── PDF File ───────────────────
  @Post('upload-file')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'userPDF', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  createPDF(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { userPDF?: Express.Multer.File[] },
  ) {
    if (!files?.userPDF?.length) {
      throw new BadRequestException('PDF file is required');
    }
    return this.userService.createPDF(userId, files as any);
  }

  @Put('upload-file')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'userPDF', maxCount: 1 }], {
      storage: multerStorage,
    }),
  )
  updatePDF(
    @CurrentUser('_id') userId: string,
    @UploadedFiles() files: { userPDF?: Express.Multer.File[] },
  ) {
    if (!files?.userPDF?.length) {
      throw new BadRequestException('PDF file is required');
    }
    return this.userService.updatePDF(userId, files as any);
  }

  @Delete('upload-file')
  @HttpCode(HttpStatus.OK)
  deletePDF(@CurrentUser('_id') userId: string) {
    return this.userService.deletePDF(userId);
  }

  // ─── Admin CRUD (parameterized — MUST be last) ────────
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  adminGetUser(@Param('id') id: string) {
    return this.userService.adminGetUserById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.userService.adminUpdateUser(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @HttpCode(HttpStatus.OK)
  adminDeleteUser(@Param('id') id: string) {
    return this.userService.adminDeleteUser(id);
  }
}
