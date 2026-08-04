import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PrintType } from '../../Printers/Schemas/printer.schema';

/** FINAL_SPEC.md §4.2 */
export enum PrintJobStatus {
  Queued = 'queued',
  Delivered = 'delivered',
  Success = 'success',
  Failed = 'failed',
  Expired = 'expired',
}

@Schema()
export class PrintPayload {
  /**
   * Already-packed Epson mono raster, not a plain PNG — named `packedBase64` rather
   * than `imageBase64` deliberately, since nothing image-file-shaped ever passes
   * through this service; it's raw packed bits from the moment rendering finishes.
   */
  @Prop({ type: String, required: true })
  packedBase64: string;

  @Prop({ type: Number, required: true })
  widthPx: number;

  @Prop({ type: Number, required: true })
  heightPx: number;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Print {
  @Prop({ type: String, required: true, index: true })
  printerId: string;

  /** Denormalized from printers.bizId at job-creation time (§4.2). */
  @Prop({ type: String, required: true, index: true })
  bizId: string;

  /** Denormalized from the order payload's location.id (§4.2). */
  @Prop({ type: String, required: true })
  locationId: string;

  /** The source order's upr_id — ties this job back to the order that generated it. */
  @Prop({ type: String, required: true, index: true })
  orderUprId: string;

  /** Copied from the target printer's own printType at job-creation time. */
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

  /**
   * Narrow, deliberate deviation from §4.2's "no mutable counters on the job
   * document" guidance: the SetResponse handler's "retry up to a configured max"
   * rule (§5.3) needs a fast, synchronous answer to "has this job already been
   * retried too many times" on every failure — querying the Kibana/ELK log trail in
   * the request path isn't a reasonable read-path for that decision. Everything
   * else about when and how many times still lives in the Kibana event trail
   * (job.retried, §12); this field exists solely to gate the retry limit.
   */
  @Prop({ type: Number, required: true, default: 0 })
  retryCount: number;

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;

  createdAt?: Date;
}

export type PrintDocument = HydratedDocument<Print>;

export const PrintSchema = SchemaFactory.createForClass(Print);
