import { ArrayNotEmpty, IsArray, IsNumber, IsOptional } from 'class-validator';

/**
 * Prime web decides which of these to send, not this service — an admin user
 * (`associate_all_locations`) passes `bizId` to see every printer on that biz;
 * a non-admin passes `locationIds` to see only printers at locations they have
 * access to. Exactly one is expected; enforced in printers.service.ts's `list()`
 * rather than here, since "at least one of these two" isn't expressible cleanly
 * with per-field class-validator decorators alone.
 */
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
