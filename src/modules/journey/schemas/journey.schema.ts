import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Journey {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true })
  preferredDate: Date;

  @Prop({ required: true })
  categoryPrice: number; // snapshot of category price at time of purchase

  @Prop({ default: 0 })
  lateFee: number; // 0 if no late fee applied

  @Prop({ required: true })
  totalPrice: number; // categoryPrice + lateFee

  @Prop({ default: false })
  isLateFeeApplied: boolean;

  @Prop({ default: 'PENDING' }) // PENDING | PAID | FAILED
  paymentStatus: string;

  @Prop({ default: 'PENDING' }) // PENDING | CLEARED (admin manages this)
  journeyStatus: string;

  @Prop({ default: null })
  stripeSessionId: string;
}

export const JourneySchema = SchemaFactory.createForClass(Journey);
export type JourneyDocument = HydratedDocument<Journey>;