import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ default: null })
  endDate: Date | null;

  // admin managed status
  @Prop({
    enum: ['PENDING', 'ACTIVE', 'CLEARED', 'EXPIRED'],
    default: 'PENDING',
  })
  status: string;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
export type MembershipDocument = HydratedDocument<Membership>;