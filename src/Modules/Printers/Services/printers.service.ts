import { randomInt } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Printer, PrinterStatus } from '../Schemas/printer.schema';
import { createPrinterDto } from '../DTO/create-printer.dto';
import { updatePrinterDto } from '../DTO/update-printer.dto';
import { listPrintersDto } from '../DTO/list-printers.dto';
import { archivePrinterDto } from '../DTO/archive-printer.dto';
import {
  getPrintWidthDots,
  PrinterModel,
} from '../../../Config/printer-capabilities';
import { ClientException } from '../../../Exceptions/ClientException';

const PRINTER_ID_LENGTH = 10;
const MAX_ID_GENERATION_ATTEMPTS = 5;
const PRINTER_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

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

  async create(dto: createPrinterDto, createdBy: string): Promise<Printer> {
    let printWidthDots: number;
    try {
      printWidthDots = getPrintWidthDots(dto.model as PrinterModel);
    } catch (err) {
      throw new ClientException({
        message: err.message,
        errorCode: 'INVALID_PRINTER_MODEL',
        statusCode: 400,
      });
    }

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
          emails: dto.emails ?? [],
        });
      } catch (err) {
        if (err?.code === 11000) {
          this.logger.log('DEBUG :: PrintersService createPrinterDto', {
            attempt,
            message: 'printerId collision on insert ... regenerating _id',
          });
          continue;
        }
        throw new ClientException({
          message: `Failed to create printer: ${err.message}`,
          errorCode: 'PRINTER_CREATE_FAILED',
          statusCode: 500,
        });
      }
    }

    throw new ClientException({
      message: 'Failed to generate a unique printerId after multiple attempts',
      errorCode: 'PRINTER_ID_GENERATION_FAILED',
      statusCode: 500,
    });
  }

  findById(printerId: string): Promise<Printer | null> {
    return this.printerModel.findById(printerId).exec();
  }

  async list(dto: listPrintersDto): Promise<Printer[]> {
    if (dto.bizId === undefined && !dto.locationIds?.length) {
      throw new ClientException({
        message: 'Either bizId or locationIds must be provided',
        errorCode: 'MISSING_LIST_FILTER',
        statusCode: 400,
      });
    }

    try {
      if (dto.bizId !== undefined) {
        return await this.printerModel.find({ bizId: dto.bizId }).exec();
      }
      return await this.printerModel
        .find({ locationIds: { $in: dto.locationIds } })
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to list printers: ${err.message}`,
        errorCode: 'PRINTER_LIST_FAILED',
        statusCode: 500,
      });
    }
  }

  async update(
    printerId: string,
    dto: updatePrinterDto,
    updatedBy: string,
  ): Promise<Printer> {
    const update: Partial<Printer> = {
      ...dto,
      updatedBy,
      updatedAt: new Date(),
    };
    if (dto.model) {
      try {
        update.printWidthDots = getPrintWidthDots(dto.model as PrinterModel);
      } catch (err) {
        throw new ClientException({
          message: err.message,
          errorCode: 'INVALID_PRINTER_MODEL',
          statusCode: 400,
        });
      }
    }

    let printer: Printer | null;
    try {
      printer = await this.printerModel
        .findByIdAndUpdate(printerId, update, { new: true })
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to update printer: ${err.message}`,
        errorCode: 'PRINTER_UPDATE_FAILED',
        statusCode: 500,
      });
    }

    if (!printer) {
      throw new ClientException({
        message: `Could not find printer with id: ${printerId}`,
        errorCode: 'PRINTER_NOT_FOUND',
        statusCode: 404,
      });
    }
    return printer;
  }

  async archive(
    printerId: string,
    dto: archivePrinterDto,
    updatedBy: string,
  ): Promise<Printer> {
    const status = dto.archived
      ? PrinterStatus.Archived
      : PrinterStatus.Offline;

    let printer: Printer | null;
    try {
      printer = await this.printerModel
        .findByIdAndUpdate(
          printerId,
          { status, updatedBy, updatedAt: new Date() },
          { new: true },
        )
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to archive printer: ${err.message}`,
        errorCode: 'PRINTER_ARCHIVE_FAILED',
        statusCode: 500,
      });
    }

    if (!printer) {
      throw new ClientException({
        message: `Could not find printer with id: ${printerId}`,
        errorCode: 'PRINTER_NOT_FOUND',
        statusCode: 404,
      });
    }
    return printer;
  }

  findFanoutTargets(bizId: number, locationId: number): Promise<Printer[]> {
    return this.printerModel
      .find({
        bizId,
        locationIds: locationId,
      })
      .exec();
  }

  async recordHeartbeat(printerId: string): Promise<void> {
    await this.printerModel
      .findByIdAndUpdate(printerId, {
        lastSeenAt: new Date(),
        status: PrinterStatus.Online,
      })
      .exec();
  }

  @Cron(CronExpression.EVERY_MINUTE)
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
