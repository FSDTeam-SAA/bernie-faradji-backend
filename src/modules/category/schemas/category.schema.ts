import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  shortDetails: string;

  @Prop({ required: true, default: 0 })
  rateActual: number;

  @Prop({ default: 0 })
  rateDiscounted: number;

  @Prop({ default: '' })
  icon: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export type CategoryDocument = HydratedDocument<Category>;