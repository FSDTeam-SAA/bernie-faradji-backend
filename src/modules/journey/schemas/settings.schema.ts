import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Settings {
  @Prop({ default: 0 })
  lateFee1: number; // 1 day behind

  @Prop({ default: 0 })
  lateFee2: number; // 2 days behind

  @Prop({ default: 0 })
  lateFee3: number; // 3+ days behind
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
export type SettingsDocument = HydratedDocument<Settings>;