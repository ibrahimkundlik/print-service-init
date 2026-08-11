import { Type } from 'class-transformer';
import { IsDefined, IsNumber, ValidateNested } from 'class-validator';

class orderLocationDto {
  @IsDefined()
  id: number | string;
}

export class ingestOrderDto {
  @IsNumber()
  @IsDefined()
  upr_id: number;

  @IsDefined()
  prime_biz_id: number | string;

  @IsDefined()
  codex_biz_id: number | string;

  @ValidateNested()
  @Type(() => orderLocationDto)
  @IsDefined()
  location: orderLocationDto;

  [key: string]: unknown;
}
