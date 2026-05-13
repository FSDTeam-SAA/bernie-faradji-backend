import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { RoleType } from '../../common/enums/role.enum';
import { createFilter, createPaginationInfo, createMeta } from '../../common/utils/pagination.util';
import { GetUsersQueryDto, UpdateUserDto, AdminUpdateUserDto } from './dto/user.dto';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { USER_LIST_FIELDS } from '../../core/constants';

const SELECT_FIELDS = USER_LIST_FIELDS;


@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}


  // ─── Admin ──────────
  async getAllUsers(query: GetUsersQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date);
    filter.role = RoleType.USER;

    const total = await this.userModel.countDocuments(filter);
    const users = await this.userModel
      .find(filter)
      .select(SELECT_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Users fetched successfully',
      meta: createMeta(page, limit, total),
      data: { users, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }


  async getAllAdmins(query: GetUsersQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter = { ...createFilter(query.search, query.date), role: RoleType.ADMIN };

    const total = await this.userModel.countDocuments(filter);
    const admins = await this.userModel
      .find(filter)
      .select(SELECT_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Admins fetched successfully',
      meta: createMeta(page, limit, total),
      data: { admins, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }


  // ─── User Profile ────────────

  async getUserById(userId: string | Types.ObjectId) {
    const user = await this.userModel.findById(userId).select(SELECT_FIELDS);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'User profile fetched successfully', data: user };
  }


  async updateUser(userId: string | Types.ObjectId, dto: UpdateUserDto) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, dto, { new: true, runValidators: true })
      .select(SELECT_FIELDS);
    if (!updated) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'User profile updated successfully', data: updated };
  }


  async deleteUser(userId: string | Types.ObjectId) {
    const deleted = await this.userModel.findByIdAndDelete(userId);
    if (!deleted) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'Your account has been deleted', data: null };
  }


  // ─── Single Avatar ──────────────

  async createAvatar(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const profileImage = files['profileImage']?.[0];
    if (!profileImage) throw new HttpException('Profile image is required', HttpStatus.BAD_REQUEST);

    const result = await this.cloudinaryService.upload(
      profileImage.path,
      `${user._id}-${Date.now()}`,
      'user-profile',
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { profileImage: result.url }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Avatar uploaded successfully', data: updated };
  }


  async updateAvatar(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const profileImage = files['profileImage']?.[0];
    if (!profileImage) throw new HttpException('Profile image is required', HttpStatus.BAD_REQUEST);

    if (user.profileImage) await this.cloudinaryService.delete(user.profileImage);

    const result = await this.cloudinaryService.upload(
      profileImage.path,
      `${user._id}-${Date.now()}`,
      'user-profile',
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { profileImage: result.url }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Avatar updated successfully', data: updated };
  }


  async deleteAvatar(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (!user.profileImage) throw new HttpException('No profile image to delete', HttpStatus.BAD_REQUEST);

    await this.cloudinaryService.delete(user.profileImage);
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { profileImage: '' }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Avatar deleted successfully', data: updated };
  }


  // ─── Multiple Avatar ───────────────

  async createMultipleAvatars(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const images = files['multiProfileImage'];
    if (!images?.length) throw new HttpException('Profile images are required', HttpStatus.BAD_REQUEST);

    const urls = await Promise.all(
      images.map((img, i) =>
        this.cloudinaryService
          .upload(img.path, `${user._id}-${Date.now()}-${i}`, 'user-profile')
          .then((r) => r.url),
      ),
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { multiProfileImage: urls }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Multiple avatars uploaded successfully', data: updated };
  }


  async updateMultipleAvatars(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const images = files['multiProfileImage'];
    if (!images?.length) throw new HttpException('Profile images are required', HttpStatus.BAD_REQUEST);

    if (user.multiProfileImage?.length) {
      await Promise.all(user.multiProfileImage.map((url) => this.cloudinaryService.delete(url)));
    }

    const urls = await Promise.all(
      images.map((img, i) =>
        this.cloudinaryService
          .upload(img.path, `${user._id}-${Date.now()}-${i}`, 'user-profile')
          .then((r) => r.url),
      ),
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { multiProfileImage: urls }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Multiple avatars updated successfully', data: updated };
  }


  async deleteMultipleAvatars(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (!user.multiProfileImage?.length) {
      throw new HttpException('No profile images to delete', HttpStatus.BAD_REQUEST);
    }

    await Promise.all(user.multiProfileImage.map((url) => this.cloudinaryService.delete(url)));
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { multiProfileImage: [] }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'Multiple avatars deleted successfully', data: updated };
  }


  // ─── PDF ─────────────────────

  async createPDF(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const pdfFile = files['userPDF']?.[0];
    if (!pdfFile) throw new HttpException('PDF file is required', HttpStatus.BAD_REQUEST);

    const result = await this.cloudinaryService.upload(
      pdfFile.path,
      `${user._id}-${Date.now()}`,
      'user-pdf',
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { pdfFile: result.url }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'PDF uploaded successfully', data: updated };
  }


  async updatePDF(userId: string, files: { [fieldname: string]: Express.Multer.File[] }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const pdfFile = files['userPDF']?.[0];
    if (!pdfFile) throw new HttpException('PDF file is required', HttpStatus.BAD_REQUEST);

    if (user.pdfFile) await this.cloudinaryService.delete(user.pdfFile);

    const result = await this.cloudinaryService.upload(
      pdfFile.path,
      `${user._id}-${Date.now()}`,
      'user-pdf',
    );

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { pdfFile: result.url }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'PDF updated successfully', data: updated };
  }


  async deletePDF(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (!user.pdfFile) throw new HttpException('No PDF file to delete', HttpStatus.BAD_REQUEST);

    await this.cloudinaryService.delete(user.pdfFile);
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { pdfFile: null }, { new: true })
      .select(SELECT_FIELDS);

    return { message: 'PDF deleted successfully', data: updated };
  }


  // ─── Admin CRUD ───────────────

  async adminGetUserById(id: string) {
    const user = await this.userModel.findById(id).select(SELECT_FIELDS);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'User fetched successfully', data: user };
  }


  async adminUpdateUser(id: string, dto: AdminUpdateUserDto) {
    const updated = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .select(SELECT_FIELDS);
    if (!updated) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'User updated successfully', data: updated };
  }


  async adminDeleteUser(id: string) {
    const deleted = await this.userModel.findByIdAndDelete(id);
    if (!deleted) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return { message: 'User deleted successfully', data: null };
  }
}