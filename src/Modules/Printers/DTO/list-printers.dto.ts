import { ArrayNotEmpty, IsArray, IsNumber, IsOptional } from 'class-validator';

export class listPrintersDto {
  @IsOptional()
  @IsNumber()
  primeBizId?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  locationIds?: number[];
}
