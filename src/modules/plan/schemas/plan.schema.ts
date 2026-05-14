import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, trim: true })
  planName: string;

  @Prop({ required: true, default: 0 })
  price: number;

  @Prop({ required: true, trim: true })
  billingCycle: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  packageIncludes: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
export type PlanDocument = HydratedDocument<Plan>;