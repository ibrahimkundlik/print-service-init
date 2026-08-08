import { randomInt } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Printer, PrinterStatus } from '../Schemas/printer.schema';
import { createPrinterDto } from '../DTO/create-printer.dto';
import { updatePrinterDto } from '../DTO/update-printer.dto';
import { listPrintersDto } from '../DTO/list-printers.dto';
import {
  getPrintWidthDots,
  PrinterModel,
} from '../../../Config/printer-capabilities';
import { ClientException } from '../../../Exceptions/ClientException';

const PRINTER_ID_LENGTH = 8;
const MAX_ID_GENERATION_ATTEMPTS = 5;
const PRINTER_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * How stale `lastSeenAt` has to be before a background sweep flips an `online`
 * printer to `offline` (§4.1). Not derived from any per-printer configured poll
 * interval — that value lives only in WebConfig, never reported back to us — so
 * this is a fixed, generously-sized threshold rather than something computed per
 * device. Adjust here if it proves too aggressive/lax in practice.
 */
const OFFLINE_THRESHOLD_MS = 60_000;

function generatePrinterId(): string {
  let id = '';
  for (let i = 0; i < PRINTER_ID_LENGTH; i++) {
    id += PRINTER_ID_CHARSET[randomInt(PRINTER_ID_CHARSET.length)];
  }
  return id;
}

@Injectable()
export class PrintersService {
  private readonly logger = new Logger(PrintersService.name);

  constructor(
    @InjectModel(Printer.name, 'mongodb')
    private readonly printerModel: Model<Printer>,
  ) {}

  /**
   * §5.2 step 1 — generates `printerId` (becomes `_id`), derives `printWidthDots`
   * from `model` (§11.1), stores as `status: 'pending'`. `createdBy` is the Prime
   * user id (`user.id`) that made the request, used later to scope `list()` for
   * non-admin callers to only the printers they personally added.
   */
  async create(dto: createPrinterDto, createdBy: number): Promise<Printer> {
    const printWidthDots = getPrintWidthDots(dto.model as PrinterModel);

    for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt++) {
      const _id = generatePrinterId();
      try {
        return await this.printerModel.create({
          _id,
          bizId: dto.bizId,
          locationIds: dto.locationIds,
          label: dto.label,
          printType: dto.printType,
          model: dto.model,
          printWidthDots,
          status: PrinterStatus.Pending,
          createdBy,
        });
      } catch (err) {
        if (err?.code === 11000) {
          this.logger.log('DEBUG :: PrintersService createPrinterDto', {
            attempt,
            message: 'printerId collision on insert ... regenerating _id',
          });
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      'Failed to generate a unique printerId after multiple attempts',
    );
  }

  findById(printerId: string): Promise<Printer | null> {
    return this.printerModel.findById(printerId).exec();
  }

  /**
   * Prime web decides which filter to send, not this service — admin users pass
   * `bizId` (every printer on that biz); non-admins pass `locationIds` (only
   * printers at locations they have access to). Exactly one is expected.
   */
  list(dto: listPrintersDto): Promise<Printer[]> {
    if (dto.bizId !== undefined) {
      return this.printerModel.find({ bizId: dto.bizId }).exec();
    }
    if (dto.locationIds?.length) {
      return this.printerModel
        .find({ locationIds: { $in: dto.locationIds } })
        .exec();
    }
    throw new ClientException({
      message: 'Either bizId or locationIds must be provided',
      errorCode: 'MISSING_LIST_FILTER',
      statusCode: 400,
    });
  }

  /**
   * Partial update — `locationIds`/`label`/`printType`/`model` only (`bizId` isn't
   * updatable, see update-printer.dto.ts). If `model` changes, `printWidthDots` is
   * recalculated the same way it is on create, rather than left stale.
   */
  async update(printerId: string, dto: updatePrinterDto): Promise<Printer> {
    const update: Partial<Printer> = { ...dto };
    if (dto.model) {
      update.printWidthDots = getPrintWidthDots(dto.model as PrinterModel);
    }

    const printer = await this.printerModel
      .findByIdAndUpdate(printerId, update, { new: true })
      .exec();
    if (!printer) {
      throw new ClientException({
        message: `Could not find printer with id: ${printerId}`,
        errorCode: 'PRINTER_NOT_FOUND',
        statusCode: 404,
      });
    }
    return printer;
  }

  /** §6 — "revoke" means delete; there's no separate disabled state. */
  async remove(printerId: string): Promise<void> {
    const result = await this.printerModel.findByIdAndDelete(printerId).exec();
    if (!result) {
      throw new ClientException({
        message: `Could not find printer with id: ${printerId}`,
        errorCode: 'PRINTER_NOT_FOUND',
        statusCode: 404,
      });
    }
  }

  /**
   * §5.1 fan-out resolution: printers whose bizId matches and whose locationIds
   * includes the order's location, excluding `pending` printers whose credentials
   * haven't been confirmed correct yet (both `online` and `offline` are valid
   * targets — offline just means "hasn't polled recently", not disabled).
   */
  findFanoutTargets(bizId: number, locationId: number): Promise<Printer[]> {
    return this.printerModel
      .find({
        bizId,
        locationIds: locationId,
        status: { $ne: PrinterStatus.Pending },
      })
      .exec();
  }

  /**
   * §5.3 GetRequest handler step 1 — heartbeat. Flips `pending`/`offline` ->
   * `online` and updates `lastSeenAt`, every poll, empty queue or not.
   */
  async recordHeartbeat(printerId: string): Promise<void> {
    await this.printerModel
      .findByIdAndUpdate(printerId, {
        lastSeenAt: new Date(),
        status: PrinterStatus.Online,
      })
      .exec();
  }

  /**
   * Background staleness sweep (§4.1) — flips `online` printers whose `lastSeenAt`
   * has fallen behind OFFLINE_THRESHOLD_MS to `offline`. Purely observational;
   * does not affect whether the printer can still poll successfully.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async markStalePrintersOffline(): Promise<void> {
    const staleBefore = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
    await this.printerModel
      .updateMany(
        { status: PrinterStatus.Online, lastSeenAt: { $lt: staleBefore } },
        { status: PrinterStatus.Offline },
      )
      .exec();
  }
}
