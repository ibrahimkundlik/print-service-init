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
export class PrintJobPayload {
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

/**
 * The printer's own SetResponse outcome for this job (§5.3) — raw `code`/`status`
 * plus their human-readable decode, see print-response.constants.ts. Set on every
 * SetResponse regardless of success/failure; `failureCode`/`failureMessage` are
 * cleared to `null` on a successful outcome.
 */
@Schema()
export class PrintJobPrinterResponse {
  @Prop({ type: String, default: null })
  failureCode: string | null;

  @Prop({ type: String, default: null })
  failureMessage: string | null;

  @Prop({ type: Number, default: null })
  statusCode: number | null;

  @Prop({ type: [String], default: [] })
  statusFlags: string[];
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PrintJob {
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

  @Prop({ type: PrintJobPayload, required: true })
  payload: PrintJobPayload;

  @Prop({ type: Number, required: true, default: 1 })
  copies: number;

  @Prop({
    type: String,
    required: true,
    enum: PrintJobStatus,
    default: PrintJobStatus.Queued,
  })
  status: PrintJobStatus;

  @Prop({ type: PrintJobPrinterResponse, default: () => ({}) })
  printerResponse: PrintJobPrinterResponse;

  @Prop({ type: Number, required: true, default: 0 })
  retryCount: number;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt?: Date;
}

export type PrintJobDocument = HydratedDocument<PrintJob>;

export const PrintJobSchema = SchemaFactory.createForClass(PrintJob);
