import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
