import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PrinterModel } from '../../../Config/printer-capabilities';

/** FINAL_SPEC.md §4.1 */
export enum PrintType {
  Bill = 'bill',
  Kot = 'kot',
}

/**
 * §4.1 — this is a liveness/observability signal, not an authorization gate (§6).
 * `pending` -> `online` on first successful poll; can flip `online` <-> `offline`
 * afterward as a periodic staleness check compares `lastSeenAt` against the
 * printer's configured interval. There's no separate revoked/disabled state — to
 * stop a printer from polling, delete its document.
 */
export enum PrinterStatus {
  Pending = 'pending',
  Online = 'online',
  Offline = 'offline',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Printer {
  /**
   * `printerId` — 8-char uppercase alphanumeric, generated at registration, not
   * operator-chosen. This *is* the primary key (no separate ObjectId), and the
   * entire value entered into WebConfig's ID field (§5.2/§6) — the route doesn't
   * carry it in the path.
   */
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  bizId: string;

  @Prop({ type: [String], required: true, default: [] })
  locationIds: string[];

  @Prop({ type: String, required: true })
  label: string;

  /**
   * What this specific physical printer prints. Drives which CorePrint function
   * runs at fan-out time (encodeOrderBill vs encodeOrderKot, §5.1/§9.3).
   */
  @Prop({ type: String, required: true, enum: PrintType })
  printType: PrintType;

  /** Exact physical model only — never a firmware family name (§4.1, §11.1). */
  @Prop({ type: String, required: true })
  model: PrinterModel;

  /**
   * Derived automatically from `model` at creation time (§11.1) — can still be
   * corrected directly on a specific document if the derived default doesn't match
   * reality (confirmed necessary for TM-m30II during the POC).
   */
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

  createdAt?: Date;
}

export type PrinterDocument = HydratedDocument<Printer>;

export const PrinterSchema = SchemaFactory.createForClass(Printer);
