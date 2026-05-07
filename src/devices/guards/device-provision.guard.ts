import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard para el endpoint POST /devices/register.
 * El ESP8266 envía el secreto en el header: x-provision-secret
 * Protege sin requerir JWT — el firmware no puede manejar tokens OAuth.
 */
@Injectable()
export class DeviceProvisionGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-provision-secret'];
    const expected = this.configService.get<string>('DEVICE_PROVISION_SECRET');

    if (!expected) {
      throw new UnauthorizedException(
        'DEVICE_PROVISION_SECRET is not configured on the server',
      );
    }

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing provision secret');
    }

    return true;
  }
}
