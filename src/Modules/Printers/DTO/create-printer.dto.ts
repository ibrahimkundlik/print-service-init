import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { PrintType } from '../Schemas/printer.schema';
import {
  PRINTER_WIDTH_DOTS,
  PrinterModel,
} from '../../../Config/printer-capabilities';

export class createPrinterDto {
  @IsString()
  @IsNotEmpty()
  bizId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  locationIds: string[];

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(PrintType)
  printType: PrintType;

  /** Exact physical model — must have an entry in Config/printer-capabilities.ts (§11.1). */
  @IsIn(Object.keys(PRINTER_WIDTH_DOTS))
  model: PrinterModel;
}
