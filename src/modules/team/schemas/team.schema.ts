import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export enum TeamPermission {
  DASHBOARD_OVERVIEW     = 'Dashboard Overview',
  USER_MANAGEMENT        = 'User Management',
  JOURNEY_MANAGEMENT     = 'Journey Management',
  CATEGORY_MANAGEMENT    = 'Category Management',
  TOKEN_MANAGEMENT       = 'Token Management',
  SET_PRIZES             = 'Set Prizes',
  TRANSACTION_MANAGEMENT = 'Transaction Management',
  SUBSCRIPTION_MANAGEMENT = 'Subscription Management',
  MEMBERSHIP_MANAGEMENT  = 'Membership Management',
  INSURANCE_LISTING      = 'Insurance Listing',
  SETTINGS               = 'Settings',
  ALL_ACCESS             = 'All Access',
}

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: String,
    enum: ['ADMIN', 'SUPER_ADMIN'],
    default: 'ADMIN',
  })
  role: string;

  @Prop({
    type: [String],
    enum: Object.values(TeamPermission),
    default: [],
  })
  permissions: string[];

  @Prop({
    type: String,
    enum: ['Active', 'Suspended'],
    default: 'Active',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Team', default: null })
  createdBy: Types.ObjectId;

  @Prop({ default: null })
  lastActive: Date;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
export type TeamDocument = HydratedDocument<Team>;

// auto hash password
TeamSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});