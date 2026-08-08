import { ArrayNotEmpty, IsArray, IsNumber, IsOptional } from 'class-validator';

export class listPrintersDto {
  @IsOptional()
  @IsNumber()
  bizId?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  locationIds?: number[];
}
