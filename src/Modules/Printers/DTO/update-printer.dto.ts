import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrintType } from '../Schemas/printer.schema';
import {
  PRINTER_WIDTH_DOTS,
  PrinterModel,
} from '../../../Config/printer-capabilities';

/**
 * `bizId` is deliberately not updatable here — it's the join key fan-out matches
 * against, not something a printer should move between after provisioning.
 */
export class updatePrinterDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  locationIds?: number[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PrintType, { each: true })
  printType?: PrintType[];

  /** Changing this recalculates and re-persists `printWidthDots` (§11.1). */
  @IsOptional()
  @IsIn(Object.keys(PRINTER_WIDTH_DOTS))
  model?: PrinterModel;
}
