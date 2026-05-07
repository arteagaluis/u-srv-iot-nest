import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateDeviceDto {
  /**
   * MAC Address del ESP8266.
   * Formato esperado: AA:BB:CC:DD:EE:FF
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
    message: 'deviceId must be a valid MAC address (e.g. AA:BB:CC:DD:EE:FF)',
  })
  deviceId: string;

  /** Nombre amigable enviado por el firmware */
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Email del propietario capturado en el portal cautivo de WiFiManager.
   * El backend busca el User por este campo.
   */
  @IsEmail()
  ownerEmail: string;

  @IsString()
  @IsOptional()
  firmwareVersion?: string;
}
