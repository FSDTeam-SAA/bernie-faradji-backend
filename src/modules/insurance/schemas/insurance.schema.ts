import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Insurance {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  shortDetails: string;

  @Prop({ required: true, default: 0 })
  rate: number;

  @Prop({ default: 0 })
  savingUpTo: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const InsuranceSchema = SchemaFactory.createForClass(Insurance);
export type InsuranceDocument = HydratedDocument<Insurance>;