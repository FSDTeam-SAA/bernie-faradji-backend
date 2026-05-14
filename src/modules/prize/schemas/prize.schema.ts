import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Prize {
  @Prop({ required: true, trim: true })
  prizeTag: string;

  @Prop({ default: false })
  isActive: boolean;
}

export const PrizeSchema = SchemaFactory.createForClass(Prize);
export type PrizeDocument = HydratedDocument<Prize>;