import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Settings {
  @Prop({ required: true, default: 0 })
  lateFee: number;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
export type SettingsDocument = HydratedDocument<Settings>;