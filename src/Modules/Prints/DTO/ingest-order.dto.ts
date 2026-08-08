import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

class orderLocationDto {
  @IsDefined()
  id: number | string;
}

export class ingestOrderDto {
  @IsString()
  @IsNotEmpty()
  upr_id: string;

  @IsString()
  @IsNotEmpty()
  biz_upr_id: string;

  @ValidateNested()
  @Type(() => orderLocationDto)
  @IsDefined()
  location: orderLocationDto;

  [key: string]: unknown;
}
