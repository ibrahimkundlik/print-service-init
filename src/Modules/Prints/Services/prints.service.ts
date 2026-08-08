import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Print, PrintJobStatus } from '../Schemas/print.schema';
import { Printer, PrintType } from '../../Printers/Schemas/printer.schema';
import { PrintersService } from '../../Printers/Services/printers.service';
import { BillRenderService } from '../../Render/Services/bill-render.service';
import {
  EposXmlBuilderService,
  EposPrintJobInput,
} from '../../Render/Services/epos-xml-builder.service';
import { ClientException } from '../../../Exceptions/ClientException';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { ingestOrderDto } from '../DTO/ingest-order.dto';
import { getMaxPayloadSizeBytes } from '../../../Config/printer-capabilities';

/**
 * How long a queued job stays eligible for delivery before the expiry sweep (§7)
 * marks it `expired`. Not a number FINAL_SPEC.md pins down; chosen as a generous but
 * bounded window for a same-order-day print job, in the same spirit as
 * OFFLINE_THRESHOLD_MS in printers.service.ts.
 */
const JOB_TTL_MS = 15 * 60 * 1000;

/**
 * Cap on `retryCount` before a failed SetResponse stops re-queuing a job (§5.3:
 * "re-queue for retry ... unless ... already been retried past a configured max").
 * Not itself numerically specified, so fixed here as an operational constant.
 */
const MAX_RETRY_COUNT = 3;

const DEFAULT_DEQUEUE_PAGE_SIZE = 20;

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

  /**
   * §5.1 — resolves fan-out targets, renders+packs once per (printer, printType)
   * pair — a printer with `printType: ['bill', 'kot']` gets one job per type, since
   * it needs both artifacts rendered for the same order — and queues one `prints`
   * doc per pair. Rendering happens synchronously inline with the request per
   * §9.3's explicit "do not defer this to a background worker in v1" call.
   */
  async ingestOrder(order: ingestOrderDto): Promise<string[]> {
    const bizId = Number(order.biz_upr_id);
    const locationId = Number(order.location.id);
    const orderUprId = order.upr_id;

    const targets = await this.printersService.findFanoutTargets(
      bizId,
      locationId,
    );
    if (targets.length === 0) {
      throw new ClientException({
        message: `No active printers registered for bizId=${bizId} locationId=${locationId}`,
        errorCode: 'NO_PRINTERS_FOR_ORDER',
        statusCode: 404,
      });
    }

    const jobIds: string[] = [];
    for (const printer of targets) {
      for (const printType of printer.printType) {
        const jobId = await this.renderAndQueueForPrinter(
          printer,
          printType,
          order,
          orderUprId,
          bizId,
          locationId,
        );
        jobIds.push(jobId);
      }
    }

    return jobIds;
  }

  private async renderAndQueueForPrinter(
    printer: Printer,
    printType: PrintType,
    order: ingestOrderDto,
    orderUprId: string,
    bizId: number,
    locationId: number,
  ): Promise<string> {
    let packed;
    try {
      packed = await this.billRenderService.renderAndPack(
        order,
        printType,
        printer.printWidthDots,
        `Order ${orderUprId}`,
      );
    } catch (err) {
      throw new ClientException({
        message: `Failed to render order ${orderUprId} for printer ${printer._id} (${printType}): ${err.message}`,
        errorCode: 'RENDER_FAILED',
        statusCode: 400,
      });
    }

    const doc = await this.printModel.create({
      printerId: printer._id,
      bizId,
      locationId,
      orderUprId,
      type: printType,
      payload: {
        packedBase64: packed.base64,
        widthPx: packed.widthPx,
        heightPx: packed.heightPx,
      },
      status: PrintJobStatus.Queued,
      expiresAt: new Date(Date.now() + JOB_TTL_MS),
    });

    this.eventLogger.logEvent('job.queued', {
      jobId: String(doc._id),
      printerId: printer._id,
      bizId,
      locationId,
      orderUprId,
      type: printType,
    });

    return String(doc._id);
  }

  async getJobStatus(jobId: string): Promise<Print> {
    const doc = await this.printModel.findById(jobId).exec();
    if (!doc) {
      throw new ClientException({
        message: `Could not find print job with id: ${jobId}`,
        errorCode: 'JOB_NOT_FOUND',
        statusCode: 404,
      });
    }
    return doc;
  }

  /**
   * §5.3 GetRequest handler steps 2-4: fetch queued jobs for this printer, cap the
   * page at the printer model's max payload size (§8 — "if the page's rendered XML
   * would exceed that, reduce the page size for that response rather than sending
   * an oversized payload"; anything trimmed stays `queued` for the next poll),
   * expand what's left into N `<ePOSPrint>` job-inputs (one per `copies`, unique
   * printjobid per copy per §9.1/§9.4), mark those docs `delivered`, and log the
   * delivery.
   */
  async dequeueForPrinter(
    printer: Printer,
    pageSize = DEFAULT_DEQUEUE_PAGE_SIZE,
  ): Promise<EposPrintJobInput[]> {
    const docs = await this.printModel
      .find({
        printerId: printer._id,
        status: PrintJobStatus.Queued,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: 1 })
      .limit(pageSize)
      .exec();

    if (docs.length === 0) {
      return [];
    }

    const maxPayloadBytes = getMaxPayloadSizeBytes();
    const selectedDocs: typeof docs = [];
    let cumulativeBytes = 0;
    for (const doc of docs) {
      const docBytes =
        Math.ceil((doc.payload.packedBase64.length * 3) / 4) * doc.copies;
      if (
        selectedDocs.length > 0 &&
        cumulativeBytes + docBytes > maxPayloadBytes
      ) {
        break;
      }
      selectedDocs.push(doc);
      cumulativeBytes += docBytes;
    }

    const jobInputs: EposPrintJobInput[] = [];
    for (const doc of selectedDocs) {
      for (let copy = 1; copy <= doc.copies; copy++) {
        jobInputs.push({
          printjobid:
            doc.copies > 1 ? `${doc._id}-copy${copy}` : String(doc._id),
          packedBase64: doc.payload.packedBase64,
          widthPx: doc.payload.widthPx,
          heightPx: doc.payload.heightPx,
        });
      }
    }

    const jobIds = selectedDocs.map((doc) => String(doc._id));
    await this.printModel
      .updateMany(
        { _id: { $in: jobIds } },
        { status: PrintJobStatus.Delivered },
      )
      .exec();

    for (const jobId of jobIds) {
      this.eventLogger.logEvent('job.delivered', {
        jobId,
        printerId: printer._id,
      });
    }

    return jobInputs;
  }

  buildPrintRequestXml(jobInputs: EposPrintJobInput[]): string {
    return this.eposXmlBuilderService.buildPrintRequestInfo(jobInputs);
  }

  /**
   * §5.3 SetResponse handler — `printjobid` may carry a `-copyN` suffix (§9.4);
   * strip it back to the source doc's `_id` before recording the outcome. On
   * failure, re-queues up to MAX_RETRY_COUNT (the `retryCount` judgment call
   * documented in print.schema.ts).
   */
  async recordSetResponseOutcome(
    printjobid: string,
    success: boolean,
    failureCode?: string,
  ): Promise<void> {
    const jobId = printjobid.split('-copy')[0];
    const doc = await this.printModel.findById(jobId).exec();
    if (!doc) {
      this.logger.log('DEBUG :: PrintsService recordSetResponseOutcome', {
        message: `SetResponse for unknown printjobid: ${printjobid}`,
      });
      return;
    }

    if (success) {
      doc.status = PrintJobStatus.Success;
      doc.failureCode = null;
      await doc.save();
      this.eventLogger.logEvent('job.success', {
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
      this.eventLogger.logEvent('job.retried', {
        jobId,
        printerId: doc.printerId,
        retryCount: doc.retryCount,
        failureCode: doc.failureCode,
      });
    } else {
      doc.status = PrintJobStatus.Failed;
      await doc.save();
      this.eventLogger.logEvent('job.failed', {
        jobId,
        printerId: doc.printerId,
        failureCode: doc.failureCode,
      });
    }
  }

  /** Background sweep (§4.2/§7) — queued jobs past `expiresAt` are marked `expired`. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleJobs(): Promise<void> {
    const staleDocs = await this.printModel
      .find({ status: PrintJobStatus.Queued, expiresAt: { $lte: new Date() } })
      .exec();

    if (staleDocs.length === 0) {
      return;
    }

    const jobIds = staleDocs.map((doc) => String(doc._id));
    await this.printModel
      .updateMany({ _id: { $in: jobIds } }, { status: PrintJobStatus.Expired })
      .exec();

    for (const doc of staleDocs) {
      this.eventLogger.logEvent('job.expired', {
        jobId: String(doc._id),
        printerId: doc.printerId,
      });
    }
  }
}
