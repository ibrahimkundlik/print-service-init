import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PrintType } from '../../Printers/Schemas/printer.schema';

export enum PrintJobStatus {
  Queued = 'queued',
  Delivered = 'delivered',
  Success = 'success',
  Failed = 'failed',
  Expired = 'expired',
}

@Schema()
export class PrintPayload {
  @Prop({ type: String, required: true })
  packedBase64: string;

  @Prop({ type: Number, required: true })
  widthPx: number;

  @Prop({ type: Number, required: true })
  heightPx: number;

  /** `packedBase64.length` + fixed `<ePOSPrint>` XML overhead — see RasterPackService. */
  @Prop({ type: Number, required: true })
  sizeBytes: number;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Print {
  @Prop({ type: String, required: true })
  printerId: string;

  @Prop({ type: Number, required: true })
  bizId: number;

  @Prop({ type: Number, required: true })
  locationId: number;

  @Prop({ type: Number, required: true })
  orderUprId: number;

  @Prop({ type: String, required: true, enum: PrintType })
  type: PrintType;

  @Prop({ type: PrintPayload, required: true })
  payload: PrintPayload;

  @Prop({ type: Number, required: true, default: 1 })
  copies: number;

  @Prop({
    type: String,
    required: true,
    enum: PrintJobStatus,
    default: PrintJobStatus.Queued,
  })
  status: PrintJobStatus;

  @Prop({ type: String, default: null })
  failureCode: string | null;

  @Prop({ type: Number, required: true, default: 0 })
  retryCount: number;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt?: Date;
}

export type PrintDocument = HydratedDocument<Print>;

export const PrintSchema = SchemaFactory.createForClass(Print);
