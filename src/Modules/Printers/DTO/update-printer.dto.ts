import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrintType } from '../Schemas/printer.schema';
import {
  PRINTER_DETAILS,
  PrinterModel,
} from '../../../Config/printer-capabilities';

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

  @IsOptional()
  @IsIn(Object.keys(PRINTER_DETAILS))
  model?: PrinterModel;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];
}
