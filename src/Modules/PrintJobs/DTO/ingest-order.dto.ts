import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';

class orderLocationDto {
  @IsDefined()
  id: number | string;
}

export class ingestOrderDto {
  @IsDefined()
  id: number | string;

  @IsDefined()
  upr_id: number | string;

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
