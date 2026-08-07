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

  @IsIn(Object.keys(PRINTER_WIDTH_DOTS))
  model: PrinterModel;
}
