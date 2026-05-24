import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Team, TeamDocument } from './schemas/team.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { EmailService } from '../../infrastructure/email/email.service';
import { RoleType } from '../../common/enums/role.enum';
import { createMeta, createPaginationInfo } from '../../common/utils/pagination.util';
import { CreateTeamDto, UpdateTeamDto, GetTeamQueryDto, TeamLoginDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private generatePassword(length = 10): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () =>
      charset[Math.floor(Math.random() * charset.length)],
    ).join('');
  }

  // ─── Team Admin Login ──────────────────────────────────
  async login(dto: TeamLoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.teamModel.findOne({ email: normalizedEmail }).select('+password');
    if (!admin) throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    const user = await this.userModel.findOne({ email: normalizedEmail }).select('isSuspended');

    if (admin.status === 'Suspended' || user?.isSuspended) {
      throw new HttpException('Your account has been suspended. Contact the super admin.', HttpStatus.FORBIDDEN);
    }

    const accessToken = this.jwtService.sign(
      { _id: admin._id, email: admin.email, role: admin.role },
    );

    return {
      message: 'Login successful',
      data: {
        accessToken,
        admin: {
          _id:         admin._id,
          name:        admin.name,
          email:       admin.email,
          role:        admin.role,
          permissions: admin.permissions,
        },
      },
    };
  }

  // ─── Create Worker Admin ───────────────────────────────
  async create(superAdminId: string, dto: CreateTeamDto) {
    const exists = await this.teamModel.findOne({ email: dto.email });
    if (exists) throw new HttpException('Admin already exists with this email', HttpStatus.CONFLICT);

    const plainPassword = this.generatePassword();

    // Save in Team collection — pre-save hook hashes password
    const admin = new this.teamModel({
      name:        dto.name,
      email:       dto.email,
      password:    plainPassword,
      permissions: dto.permissions,
      createdBy:   superAdminId,
      role:        'ADMIN',
    });
    await admin.save();

    // Sync to Users collection for JWT auth guard
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = await this.userModel.findOne({ email: normalizedEmail });

    if (!existingUser) {
      const newUser = new this.userModel({
        name:     dto.name,
        email:    normalizedEmail,
        password: plainPassword,
        role:     RoleType.ADMIN,
      });
      await newUser.save();
    }

    // Send credentials email
    try {
      await this.emailService.sendEmail({
        to: dto.email,
        subject: 'Your Admin Account Credentials — BubbleDrive',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to BubbleDrive Admin, ${dto.name}!</h2>
            <p>Your login credentials for the admin dashboard:</p>
            <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background:#f3f4f6;">
                <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Email</strong></td>
                <td style="padding:10px; border:1px solid #e5e7eb;">${dto.email}</td>
              </tr>
              <tr>
                <td style="padding:10px; border:1px solid #e5e7eb;"><strong>Password</strong></td>
                <td style="padding:10px; border:1px solid #e5e7eb;">${plainPassword}</td>
              </tr>
            </table>
            <p>Login here: <a href="https://admin.bubbledrive.co.uk/">https://admin.bubbledrive.co.uk/</a></p>
            <p>Please change your password after first login.</p>
            <p>Regards,<br/>BubbleDrive Team</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    return {
      message: 'Worker admin created successfully and credentials sent via email',
      data: {
        _id:         admin._id,
        name:        admin.name,
        email:       admin.email,
        role:        admin.role,
        permissions: admin.permissions,
        status:      admin.status,
        createdBy:   admin.createdBy,
      },
    };
  }

  // ─── Get All Admins ────────────────────────────────────
  async getAll(query: GetTeamQueryDto) {
    const page  = Number(query.page  || 1);
    const limit = Number(query.limit || 10);
    const filter: any = {};

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }
    if (query.status) filter.status = query.status;

    const total  = await this.teamModel.countDocuments(filter);
    const admins = await this.teamModel
      .find(filter)
      .select('-password')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Admins fetched successfully',
      meta: createMeta(page, limit, total),
      data: { admins, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Get Single Admin ──────────────────────────────────
  async getOne(id: string) {
    const admin = await this.teamModel
      .findById(id)
      .select('-password')
      .populate('createdBy', 'name email');
    if (!admin) throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    return { message: 'Admin fetched successfully', data: admin };
  }

  // ─── Update Permissions / Status ──────────────────────
  async update(id: string, dto: UpdateTeamDto) {
    const payload: any = {};
    if (dto.permissions) payload.permissions = dto.permissions;
    if (typeof dto.isSuspended === 'boolean') {
      payload.status = dto.isSuspended ? 'Suspended' : 'Active';
    } else if (dto.status) {
      payload.status = dto.status;
    }

    const admin = await this.teamModel
      .findByIdAndUpdate(id, payload, { new: true })
      .select('-password');
    if (!admin) throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);

    // sync suspension status to users collection
    if (payload.status) {
      await this.userModel.findOneAndUpdate(
        { email: admin.email },
        {
          isSuspended: payload.status === 'Suspended',
          ...(payload.status === 'Suspended' && { refreshToken: null }),
        },
      );
    }

    return { message: 'Admin updated successfully', data: admin };
  }

  // ─── Delete Admin ──────────────────────────────────────
  async remove(id: string) {
    const admin = await this.teamModel.findById(id);
    if (!admin) throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);

    // also remove from users collection
    await this.userModel.findOneAndDelete({ email: admin.email });
    await this.teamModel.findByIdAndDelete(id);

    return { message: 'Admin deleted successfully', data: null };
  }
}
