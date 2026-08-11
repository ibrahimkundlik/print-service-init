import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import {
  PrintJob,
  PrintJobDocument,
  PrintJobStatus,
} from '../Schemas/print-job.schema';
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
import {
  describeResponseCode,
  describeResponseStatus,
} from '../Config/print-response.constants';

const MAX_RETRY_COUNT = 3;
const JOB_TTL_MS = 500 * 60 * 1000; // TODO - Revert to 10 after testing is completed
const DEFAULT_DEQUEUE_PAGE_SIZE = 10; // TODO - Recheck this once final testing is completed
const JOBS_LOOKBACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PrintJobsService {
  private readonly logger = new Logger(PrintJobsService.name);

  constructor(
    @InjectModel(PrintJob.name, 'mongodb')
    private readonly printJobModel: Model<PrintJob>,
    private readonly printersService: PrintersService,
    private readonly billRenderService: BillRenderService,
    private readonly eposXmlBuilderService: EposXmlBuilderService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async ingestOrder(order: ingestOrderDto): Promise<void> {
    const primeBizId = Number(order.prime_biz_id);
    const codexBizId = Number(order.codex_biz_id);
    const orderUprId = Number(order.upr_id);
    const locationId = Number(order.location.id);
    const logPayload = { primeBizId, orderUprId, locationId };

    let existingJob: PrintJobDocument | null;
    try {
      existingJob = await this.printJobModel
        .findOne({ primeBizId, orderUprId })
        .exec();
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'DUPLICATE_CHECK_FAILED',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 500,
        errorCode: 'DUPLICATE_CHECK_FAILED',
        message: `Failed to check for duplicate order ${orderUprId}: ${err.message}`,
      });
    }

    if (existingJob) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'DUPLICATE_ORDER',
        ...logPayload,
      });
      return;
    }

    let targets: Printer[];
    try {
      targets = await this.printersService.findFanoutTargets(
        primeBizId,
        locationId,
      );
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'PRINTER_LOOKUP_FAILED',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 500,
        errorCode: 'PRINTER_LOOKUP_FAILED',
        message: `Failed to resolve printers for primeBizId=${primeBizId} locationId=${locationId}: ${err.message}`,
      });
    }

    if (targets.length === 0) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'PRINTER_NOT_FOUND',
        ...logPayload,
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
          primeBizId,
          codexBizId,
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
    primeBizId: number,
    codexBizId: number,
    locationId: number,
  ): Promise<void> {
    let packed;
    const logPayload = {
      primeBizId,
      orderUprId,
      locationId,
      type: printType,
      printerId: printer._id,
    };

    try {
      packed = await this.billRenderService.renderAndPack(
        order,
        printType,
        printer.printWidthDots,
        `Order ${orderUprId}`,
      );
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'PRINT_RENDER_FAILED',
        error: err?.message,
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 400,
        errorCode: 'PRINT_RENDER_FAILED',
        message: `Failed to render order ${orderUprId} for printer ${printer._id} (${printType}): ${err.message}`,
      });
    }

    let doc: PrintJobDocument;
    try {
      doc = await this.printJobModel.create({
        printerId: printer._id,
        primeBizId,
        codexBizId,
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
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'PRINT_JOB_CREATE_FAILED',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 500,
        errorCode: 'PRINT_JOB_CREATE_FAILED',
        message: `Failed to queue print job for order ${orderUprId} (printer ${printer._id}): ${err.message}`,
      });
    }

    this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
      status: 'queued',
      jobId: String(doc._id),
      ...logPayload,
    });
  }

  async getAllJobsForPrinter(printerId: string): Promise<PrintJob[]> {
    const since = new Date(Date.now() - JOBS_LOOKBACK_MS);
    try {
      return await this.printJobModel
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
    let docs: PrintJobDocument[];
    try {
      docs = await this.printJobModel
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
      await this.printJobModel
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

    for (const doc of selectedDocs) {
      this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
        status: 'delivered',
        type: doc.type,
        primeBizId: doc.primeBizId,
        jobId: String(doc._id),
        printerId: printer._id,
        locationId: doc.locationId,
        orderUprId: doc.orderUprId,
      });
    }

    return jobInputs;
  }

  buildPrintRequestXml(jobInputs: EposPrintJobInput[]): string {
    return this.eposXmlBuilderService.buildPrintRequestInfo(jobInputs);
  }

  async recordSetResponseOutcome(
    printerId: string,
    printjobid: string,
    success: boolean,
    failureCode?: string,
    statusCode?: number,
  ): Promise<void> {
    const jobId = printjobid.split('-copy')[0];
    const statusFlags = describeResponseStatus(statusCode);
    const basePayload = { jobId, printerId };

    let doc: PrintJobDocument | null;
    try {
      doc = await this.printJobModel.findById(jobId).exec();
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        ...basePayload,
        error: err?.message,
        event: 'JOB_LOOKUP_FAILED',
      });
      return;
    }

    if (!doc) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        ...basePayload,
        event: 'JOB_NOT_FOUND',
      });
      return;
    }

    const printJobPayload = {
      jobId,
      type: doc.type,
      primeBizId: doc.primeBizId,
      printerId: doc.printerId,
      locationId: doc.locationId,
      orderUprId: doc.orderUprId,
    };

    try {
      doc.printerResponse.statusCode = statusCode ?? null;
      doc.printerResponse.statusFlags = statusFlags;

      if (success) {
        doc.status = PrintJobStatus.Success;
        doc.printerResponse.failureCode = null;
        doc.printerResponse.failureMessage = null;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
          ...printJobPayload,
          status: 'success',
          printerResponse: doc.printerResponse,
        });
        return;
      }

      doc.printerResponse.failureCode = failureCode ?? 'UNKNOWN';
      doc.printerResponse.failureMessage = describeResponseCode(
        doc.printerResponse.failureCode,
      );
      if (doc.retryCount < MAX_RETRY_COUNT) {
        doc.retryCount += 1;
        doc.status = PrintJobStatus.Queued;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
          ...printJobPayload,
          status: 'retried',
          retryCount: doc.retryCount,
          printerResponse: doc.printerResponse,
        });
      } else {
        doc.status = PrintJobStatus.Failed;
        await doc.save();
        this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
          ...printJobPayload,
          status: 'failed',
          printerResponse: doc.printerResponse,
        });
      }
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        ...basePayload,
        error: err?.message,
        event: 'JOB_UPDATE_FAILED',
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleJobs(): Promise<void> {
    try {
      const staleDocs = await this.printJobModel
        .find({
          status: PrintJobStatus.Queued,
          expiresAt: { $lte: new Date() },
        })
        .exec();

      if (staleDocs.length === 0) {
        return;
      }

      const jobIds = staleDocs.map((doc) => String(doc._id));
      await this.printJobModel
        .updateMany(
          { _id: { $in: jobIds } },
          { status: PrintJobStatus.Expired },
        )
        .exec();

      for (const doc of staleDocs) {
        this.eventLogger.logEvent(LogEvents.PRINT_JOB, {
          status: 'expired',
          type: doc.type,
          primeBizId: doc.primeBizId,
          jobId: String(doc._id),
          printerId: doc.printerId,
          locationId: doc.locationId,
          orderUprId: doc.orderUprId,
        });
      }
    } catch (err) {
      // TODO
    }
  }
}
