import { IsEmail } from 'class-validator';

export class ShareDeviceDto {
  /** Email del usuario registrado al que se le dará acceso */
  @IsEmail()
  targetEmail: string;
}
