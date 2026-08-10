import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

class orderLocationDto {
  @IsDefined()
  id: number | string;
}

export class ingestOrderDto {
  @IsNumber()
  @IsDefined()
  upr_id: number;

  @IsString()
  @IsNotEmpty()
  codex_biz_id: string;

  @ValidateNested()
  @Type(() => orderLocationDto)
  @IsDefined()
  location: orderLocationDto;

  [key: string]: unknown;
}
