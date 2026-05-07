import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ShareDeviceDto } from './dto/share-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceProvisionGuard } from './guards/device-provision.guard';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * POST /devices/register
   * Llamado por el firmware del ESP8266 al arrancar.
   * Protegido por DEVICE_PROVISION_SECRET (sin JWT).
   */
  @Post('register')
  @UseGuards(DeviceProvisionGuard)
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: CreateDeviceDto) {
    return this.devicesService.registerDevice(dto);
  }

  /**
   * GET /devices
   * Lista todos los dispositivos del usuario autenticado
   * (propios + compartidos con él).
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  getMyDevices(@Request() req) {
    return this.devicesService.getMyDevices(req.user.userId);
  }

  /**
   * GET /devices/:deviceId
   * Detalle de un dispositivo (owner o usuario con acceso compartido).
   */
  @Get(':deviceId')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('deviceId') deviceId: string, @Request() req) {
    return this.devicesService.getOneDevice(deviceId, req.user.userId);
  }

  /**
   * PATCH /devices/:deviceId
   * Actualiza nombre/descripción (solo owner).
   */
  @Patch(':deviceId')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto,
    @Request() req,
  ) {
    return this.devicesService.updateDevice(deviceId, req.user.userId, dto);
  }

  /**
   * DELETE /devices/:deviceId
   * Elimina un dispositivo (solo owner).
   */
  @Delete(':deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('deviceId') deviceId: string, @Request() req) {
    return this.devicesService.deleteDevice(deviceId, req.user.userId);
  }

  /**
   * POST /devices/:deviceId/share
   * Comparte el dispositivo con otro usuario registrado (solo owner).
   */
  @Post(':deviceId/share')
  @UseGuards(JwtAuthGuard)
  share(
    @Param('deviceId') deviceId: string,
    @Body() dto: ShareDeviceDto,
    @Request() req,
  ) {
    return this.devicesService.shareDevice(deviceId, req.user.userId, dto);
  }

  /**
   * DELETE /devices/:deviceId/share/:userId
   * Revoca el acceso compartido de un usuario (solo owner).
   */
  @Delete(':deviceId/share/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeShare(
    @Param('deviceId') deviceId: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    return this.devicesService.revokeShare(deviceId, req.user.userId, userId);
  }

  /**
   * GET /devices/:deviceId/telemetry
   * Obtiene el histórico de datos (sensores) para graficar en el frontend.
   */
  @Get(':deviceId/telemetry')
  @UseGuards(JwtAuthGuard)
  getTelemetry(
    @Param('deviceId') deviceId: string,
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.devicesService.getTelemetry(deviceId, req.user.userId, limitNum);
  }
}
