import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgetPasswordDto,
  VerifyCodeDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { EmailService } from '../../infrastructure/email/email.service';
import { generateOtp } from '../../common/utils/otp.util';


@Injectable()
export class AuthService {
  private readonly accessSecret:    string;
  private readonly accessExpires:   string;
  private readonly refreshSecret:   string;
  private readonly refreshExpires:  string;
  private readonly otpExpires:      number;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.accessSecret   = this.configService.get<string>('auth.accessTokenSecret')!;
    this.accessExpires  = this.configService.get<string>('auth.accessTokenExpires', '7d');
    this.refreshSecret  = this.configService.get<string>('auth.refreshTokenSecret')!;
    this.refreshExpires = this.configService.get<string>('auth.refreshTokenExpires', '10d');
    this.otpExpires     = this.configService.get<number>('auth.otpExpires', 900000);
  }

  private issueAccessToken(payload: object): string {
    return jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpires as any });
  }

  private issueRefreshToken(payload: object): string {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpires as any });
  }

  // ─── Auth ───────────────
  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new HttpException('User already registered', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userModel.create(dto);

    return {
      message: 'Registered user successfully!',
      data: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        profileImage: user.profileImage,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email }).select('+password');
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const isMatch = await user.comparePassword(dto.password);
    if (!isMatch) {
      throw new HttpException('Invalid password', HttpStatus.BAD_REQUEST);
    }

    const payload      = { _id: user._id.toString(), role: user.role };
    const refreshToken = this.issueRefreshToken(payload);
    user.refreshToken  = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
      message: 'Login successful',
      data: {
        user: {
          _id:          user._id,
          name:         user.name,
          email:        user.email,
          role:         user.role,
          profileImage: user.profileImage,
          refreshToken,
        },
        accessToken: this.issueAccessToken(payload),
      },
    };
  }

  async refreshAccessToken(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new HttpException('No refresh token provided', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userModel.findOne({ refreshToken: dto.refreshToken });
    if (!user) {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }

    try {
      const decoded: any = jwt.verify(dto.refreshToken, this.refreshSecret);

      if (decoded._id !== user._id.toString()) {
        throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
      }

      const payload         = { _id: user._id.toString(), role: user.role };
      const newRefreshToken = this.issueRefreshToken(payload);
      user.refreshToken     = newRefreshToken;
      await user.save({ validateBeforeSave: false });

      return {
        message: 'Token refreshed',
        data: {
          accessToken:  this.issueAccessToken(payload),
          refreshToken: newRefreshToken,
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Invalid or expired refresh token', HttpStatus.UNAUTHORIZED);
    }
  }

  async forgetPassword(dto: ForgetPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      throw new HttpException('Invalid email', HttpStatus.NOT_FOUND);
    }

    const otp = generateOtp();
    user.otp         = otp;
    user.otpExpires  = new Date(Date.now() + this.otpExpires);
    user.otpVerified = false;
    user.resetExpires = null;
    await user.save({ validateBeforeSave: false });

    await this.emailService.sendOtpEmail(dto.email, otp);

    return { message: 'Verification code sent to your email', data: null };
  }

  async verifyCode(dto: VerifyCodeDto) {
    const user = await this.userModel.findOne({ email: dto.email });

    if (!user || !user.otp || !user.otpExpires) {
      throw new HttpException('OTP not found', HttpStatus.NOT_FOUND);
    }

    if (user.otp !== dto.otp || Date.now() > user.otpExpires.getTime()) {
      throw new HttpException('Invalid or expired OTP', HttpStatus.FORBIDDEN);
    }

    user.otp          = null;
    user.otpExpires   = null;
    user.otpVerified  = true;
    user.resetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    return { message: 'Verification successful', data: null };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new HttpException('Invalid email', HttpStatus.NOT_FOUND);

    if (!user.otpVerified || !user.resetExpires) {
      throw new HttpException('OTP verification required', HttpStatus.FORBIDDEN);
    }

    if (Date.now() > user.resetExpires.getTime()) {
      throw new HttpException('Reset session expired', HttpStatus.FORBIDDEN);
    }

    user.password     = dto.newPassword;
    user.otpVerified  = false;
    user.resetExpires = null;
    await user.save();

    return { message: 'Password reset successfully', data: null };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const isMatch = await user.comparePassword(dto.oldPassword);
    if (!isMatch) {
      throw new HttpException('Invalid old password', HttpStatus.BAD_REQUEST);
    }

    user.password = dto.newPassword;
    await user.save();

    return { message: 'Password changed successfully', data: null };
  }

  async logout(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
    return { message: 'Logged out successfully', data: null };
  }
}
