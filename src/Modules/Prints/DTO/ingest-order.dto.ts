import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Only the handful of fields this service actually reads (§5.1's field-mapping
 * table) are validated. The rest of the raw order payload — `data`, `status`,
 * `updated_at_unix`, etc. — passes through untouched to the render pipeline;
 * `main.ts`'s ValidationPipe has no `whitelist: true`, so extra properties survive.
 */
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
