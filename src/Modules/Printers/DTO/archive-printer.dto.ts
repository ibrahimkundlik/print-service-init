import { IsBoolean } from 'class-validator';

export class archivePrinterDto {
  @IsBoolean()
  archived: boolean;
}
