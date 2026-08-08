import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Print, PrintDocument, PrintJobStatus } from '../Schemas/print.schema';
import { Printer, PrintType } from '../../Printers/Schemas/printer.schema';
import { PrintersService } from '../../Printers/Services/printers.service';
import { BillRenderService } from '../../Render/Services/bill-render.service';
import {
  EposXmlBuilderService,
  EposPrintJobInput,
} from '../../Render/Services/epos-xml-builder.service';
import { ClientException } from '../../../Exceptions/ClientException';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { LogEvents } from '../../Logger/logger.constants';
import { ingestOrderDto } from '../DTO/ingest-order.dto';
import { getMaxPayloadSizeBytes } from '../../../Config/printer-capabilities';

const MAX_RETRY_COUNT = 3;
const JOB_TTL_MS = 500 * 60 * 1000; // TODO - Revert to 10 after testing is completed
const DEFAULT_DEQUEUE_PAGE_SIZE = 10; // TODO - Recheck this once final testing is completed
const JOBS_LOOKBACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PrintsService {
  private readonly logger = new Logger(PrintsService.name);

  constructor(
    @InjectModel(Print.name, 'mongodb')
    private readonly printModel: Model<Print>,
    private readonly printersService: PrintersService,
    private readonly billRenderService: BillRenderService,
    private readonly eposXmlBuilderService: EposXmlBuilderService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async ingestOrder(order: ingestOrderDto): Promise<void> {
    const bizId = Number(order.biz_upr_id);
    const orderUprId = Number(order.upr_id);
    const locationId = Number(order.location.id);

    let targets: Printer[];
    try {
      targets = await this.printersService.findFanoutTargets(bizId, locationId);
    } catch (err) {
      throw new ClientException({
        message: `Failed to resolve printers for bizId=${bizId} locationId=${locationId}: ${err.message}`,
        errorCode: 'PRINTER_LOOKUP_FAILED',
        statusCode: 500,
      });
    }

    if (targets.length === 0) {
      this.eventLogger.logEvent(LogEvents.NO_PRINTERS, {
        bizId,
        locationId,
        orderUprId,
      });
      return;
    }

    for (const printer of targets) {
      for (const printType of printer.printType) {
        await this.renderAndQueueForPrinter(
          printer,
          printType,
          order,
          orderUprId,
          bizId,
          locationId,
        );
      }
    }
  }

  private async renderAndQueueForPrinter(
    printer: Printer,
    printType: PrintType,
    order: ingestOrderDto,
    orderUprId: number,
    bizId: number,
    locationId: number,
  ): Promise<void> {
    let packed;
    try {
      packed = await this.billRenderService.renderAndPack(
        order,
        printType,
        printer.printWidthDots,
        `Order ${orderUprId}`,
      );
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.RENDER_FAILED, {
        printerId: printer._id,
        bizId,
        locationId,
        orderUprId,
        type: printType,
        error: err.message,
      });

      throw new ClientException({
        message: `Failed to render order ${orderUprId} for printer ${printer._id} (${printType}): ${err.message}`,
        errorCode: 'RENDER_FAILED',
        statusCode: 400,
      });
    }

    let doc: PrintDocument;
    try {
      doc = await this.printModel.create({
        printerId: printer._id,
        bizId,
        locationId,
        orderUprId,
        type: printType,
        payload: {
          widthPx: packed.widthPx,
          heightPx: packed.heightPx,
          packedBase64: packed.base64,
          sizeBytes: packed.sizeBytes,
        },
        status: PrintJobStatus.Queued,
        expiresAt: new Date(Date.now() + JOB_TTL_MS),
      });
    } catch (err) {
      throw new ClientException({
        message: `Failed to queue print job for order ${orderUprId} (printer ${printer._id}): ${err.message}`,
        errorCode: 'PRINT_JOB_CREATE_FAILED',
        statusCode: 500,
      });
    }

    this.eventLogger.logEvent(LogEvents.JOB_QUEUED, {
      jobId: String(doc._id),
      printerId: printer._id,
      bizId,
      locationId,
      orderUprId,
      type: printType,
    });
  }

  async getAllJobsForPrinter(printerId: string): Promise<Print[]> {
    const since = new Date(Date.now() - JOBS_LOOKBACK_MS);
    try {
      return await this.printModel
        .find({ printerId, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to fetch jobs for printer ${printerId}: ${err.message}`,
        errorCode: 'JOBS_LOOKUP_FAILED',
        statusCode: 500,
      });
    }
  }

  async dequeueForPrinter(
    printer: Printer,
    pageSize = DEFAULT_DEQUEUE_PAGE_SIZE,
  ): Promise<EposPrintJobInput[]> {
    let docs: PrintDocument[];
    try {
      docs = await this.printModel
        .find({
          printerId: printer._id,
          status: PrintJobStatus.Queued,
          expiresAt: { $gt: new Date() },
        })
        .sort({ createdAt: 1 })
        .limit(pageSize)
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to dequeue jobs for printer ${printer._id}: ${err.message}`,
        errorCode: 'JOB_DEQUEUE_FAILED',
        statusCode: 500,
      });
    }

    if (docs.length === 0) {
      return [];
    }

    let maxPayloadBytes: number;
    try {
      maxPayloadBytes = getMaxPayloadSizeBytes(printer.model);
    } catch (err) {
      throw new ClientException({
        message: `Failed to dequeue jobs for printer ${printer._id}: ${err.message}`,
        errorCode: 'JOB_DEQUEUE_FAILED',
        statusCode: 500,
      });
    }
    const selectedDocs: typeof docs = [];
    let cumulativeBytes = 0;
    for (const doc of docs) {
      const docBytes = doc.payload.sizeBytes;
      if (
        selectedDocs.length > 0 &&
        cumulativeBytes + docBytes > maxPayloadBytes
      ) {
        break;
      }
      selectedDocs.push(doc);
      cumulativeBytes += docBytes;
    }

    const jobInputs: EposPrintJobInput[] = selectedDocs.map((doc) => ({
      printjobid: String(doc._id),
      packedBase64: doc.payload.packedBase64,
      widthPx: doc.payload.widthPx,
      heightPx: doc.payload.heightPx,
    }));

    const jobIds = selectedDocs.map((doc) => String(doc._id));
    try {
      await this.printModel
        .updateMany(
          { _id: { $in: jobIds } },
          { status: PrintJobStatus.Delivered },
        )
        .exec();
    } catch (err) {
      throw new ClientException({
        message: `Failed to mark jobs delivered for printer ${printer._id}: ${err.message}`,
        errorCode: 'JOB_DELIVERY_UPDATE_FAILED',
        statusCode: 500,
      });
    }

    for (const jobId of jobIds) {
      this.eventLogger.logEvent(LogEvents.JOB_DELIVERED, {
        jobId,
        printerId: printer._id,
      });
    }

    return jobInputs;
  }

  buildPrintRequestXml(jobInputs: EposPrintJobInput[]): string {
    return this.eposXmlBuilderService.buildPrintRequestInfo(jobInputs);
  }

  async recordSetResponseOutcome(
    printjobid: string,
    success: boolean,
    failureCode?: string,
  ): Promise<void> {
    const jobId = printjobid.split('-copy')[0];

    let doc: PrintDocument | null;
    try {
      doc = await this.printModel.findById(jobId).exec();
    } catch (err) {
      this.logger.log('DEBUG :: PrintsService recordSetResponseOutcome', {
        message: `Failed to look up printjobid ${printjobid}: ${err.message}`,
      });
      return;
    }

    if (!doc) {
      this.logger.log('DEBUG :: PrintsService recordSetResponseOutcome', {
        message: `SetResponse for unknown printjobid: ${printjobid}`,
      });
      return;
    }

    try {
      if (success) {
        doc.status = PrintJobStatus.Success;
        doc.failureCode = null;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.JOB_SUCCESS, {
          jobId,
          printerId: doc.printerId,
        });
        return;
      }

      doc.failureCode = failureCode ?? 'UNKNOWN';
      if (doc.retryCount < MAX_RETRY_COUNT) {
        doc.retryCount += 1;
        doc.status = PrintJobStatus.Queued;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.JOB_RETRIED, {
          jobId,
          printerId: doc.printerId,
          retryCount: doc.retryCount,
          failureCode: doc.failureCode,
        });
      } else {
        doc.status = PrintJobStatus.Failed;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.JOB_FAILED, {
          jobId,
          printerId: doc.printerId,
          failureCode: doc.failureCode,
        });
      }
    } catch (err) {
      this.logger.log('DEBUG :: PrintsService recordSetResponseOutcome', {
        message: `Failed to persist outcome for printjobid ${printjobid}: ${err.message}`,
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleJobs(): Promise<void> {
    try {
      const staleDocs = await this.printModel
        .find({
          status: PrintJobStatus.Queued,
          expiresAt: { $lte: new Date() },
        })
        .exec();

      if (staleDocs.length === 0) {
        return;
      }

      const jobIds = staleDocs.map((doc) => String(doc._id));
      await this.printModel
        .updateMany(
          { _id: { $in: jobIds } },
          { status: PrintJobStatus.Expired },
        )
        .exec();

      for (const doc of staleDocs) {
        this.eventLogger.logEvent(LogEvents.JOB_EXPIRED, {
          jobId: String(doc._id),
          printerId: doc.printerId,
        });
      }
    } catch (err) {
      this.logger.log('DEBUG :: PrintsService expireStaleJobs', {
        message: `Failed to expire stale jobs: ${err.message}`,
      });
    }
  }
}
