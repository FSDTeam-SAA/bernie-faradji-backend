import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Token {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ type: [String], default: [] })
  ticketCodes: string[];

  @Prop({ required: true })
  month: number; // 1-12

  @Prop({ required: true })
  year: number; // e.g. 2026

  @Prop({ default: 'PENDING' }) // PENDING | PAID | FAILED
  paymentStatus: string;

  @Prop({ default: null })
  stripeSessionId: string;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
export type TokenDocument = HydratedDocument<Token>;