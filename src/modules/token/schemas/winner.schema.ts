import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Winner {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Token', required: true })
  tokenId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Prize', default: null })
  prizeId: Types.ObjectId; // active prize at time of selection

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ default: null })
  winningCode: string; // the specific ticket code that won e.g. 'BBD-A1B2C3'

  @Prop({ enum: ['MANUAL', 'AUTO'], required: true })
  selectionType: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const WinnerSchema = SchemaFactory.createForClass(Winner);
export type WinnerDocument = HydratedDocument<Winner>;