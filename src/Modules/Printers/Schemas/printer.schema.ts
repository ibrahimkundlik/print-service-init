import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PrinterModel } from '../../../Config/printer-capabilities';

export enum PrintType {
  Bill = 'bill',
  Kot = 'kot',
}

export enum PrinterStatus {
  Pending = 'pending',
  Online = 'online',
  Offline = 'offline',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Printer {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, required: true })
  bizId: number;

  @Prop({ type: [Number], required: true, default: [] })
  locationIds: number[];

  @Prop({ type: String, required: true })
  label: string;

  @Prop({ type: [String], required: true, enum: PrintType })
  printType: PrintType[];

  @Prop({ type: String, required: true })
  model: PrinterModel;

  @Prop({ type: Number, required: true })
  printWidthDots: number;

  @Prop({
    type: String,
    required: true,
    enum: PrinterStatus,
    default: PrinterStatus.Pending,
  })
  status: PrinterStatus;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  /** Prime user id (`user.id` from the authorities response) that created this printer. */
  @Prop({ type: Number, required: true })
  createdBy: number;

  createdAt?: Date;
}

export type PrinterDocument = HydratedDocument<Printer>;

export const PrinterSchema = SchemaFactory.createForClass(Printer);
