import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ShareDeviceDto } from './dto/share-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { IDeviceWithRole } from './interfaces/device.interface';
import { Device, DeviceDocument } from './schemas/device.schema';
import { Telemetry, TelemetryDocument } from './schemas/telemetry.schema';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Telemetry.name) private readonly telemetryModel: Model<TelemetryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Registra un dispositivo nuevo o actualiza uno existente.
   * Llamado por el firmware del ESP8266 (sin JWT).
   * Protegido por DEVICE_PROVISION_SECRET en el guard del controller.
   */
  async registerDevice(dto: CreateDeviceDto): Promise<DeviceDocument> {
    const owner = await this.userModel.findOne({ email: dto.ownerEmail.toLowerCase() });
    if (!owner) {
      throw new NotFoundException(`No user found with email: ${dto.ownerEmail}`);
    }

    const existing = await this.deviceModel.findOne({ deviceId: dto.deviceId });
    if (existing) {
      // El dispositivo ya existe: idempotente — solo actualiza firmware si cambió
      if (dto.firmwareVersion && existing.firmwareVersion !== dto.firmwareVersion) {
        existing.firmwareVersion = dto.firmwareVersion;
        await existing.save();
      }
      return existing;
    }

    const device = await this.deviceModel.create({
      deviceId: dto.deviceId,
      name: dto.name,
      description: dto.description,
      ownerId: owner._id,
      firmwareVersion: dto.firmwareVersion,
      status: 'pending',
    });

    return device;
  }

  /**
   * Lista todos los dispositivos accesibles por el usuario:
   * propios (ownerId) + compartidos (sharedWith).
   * Incluye el campo calculado `isOwner` para que el frontend pueda
   * determinar qué acciones (editar, eliminar, compartir) están permitidas.
   */
  async getMyDevices(userId: string): Promise<IDeviceWithRole[]> {
    const userObjectId = new Types.ObjectId(userId);
    const devices = await this.deviceModel
      .find({
        $or: [{ ownerId: userObjectId }, { sharedWith: userObjectId }],
      })
      .lean()
      .exec();

    return devices.map((device) => ({
      ...device,
      isOwner: device.ownerId.toString() === userId,
    }));
  }

  /**
   * Retorna el detalle de un dispositivo si el usuario tiene acceso.
   * Incluye el campo calculado `isOwner` igual que en `getMyDevices`.
   */
  async getOneDevice(deviceId: string, userId: string): Promise<IDeviceWithRole> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertAccess(device, userId);
    return {
      ...device.toObject(),
      isOwner: device.ownerId.toString() === userId,
    };
  }

  /**
   * Actualiza nombre/descripción de un dispositivo (solo el owner).
   */
  async updateDevice(
    deviceId: string,
    userId: string,
    dto: UpdateDeviceDto,
  ): Promise<DeviceDocument> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertOwnership(device, userId);

    Object.assign(device, dto);
    return device.save();
  }

  /**
   * Elimina un dispositivo (solo el owner).
   */
  async deleteDevice(deviceId: string, userId: string): Promise<void> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertOwnership(device, userId);
    await device.deleteOne();
  }

  /**
   * Comparte el dispositivo con otro usuario registrado por email.
   */
  async shareDevice(
    deviceId: string,
    ownerId: string,
    dto: ShareDeviceDto,
  ): Promise<DeviceDocument> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertOwnership(device, ownerId);

    const targetUser = await this.userModel.findOne({
      email: dto.targetEmail.toLowerCase(),
    });
    if (!targetUser) {
      throw new NotFoundException(`No user found with email: ${dto.targetEmail}`);
    }

    const targetId = targetUser._id as Types.ObjectId;
    const ownerObjectId = new Types.ObjectId(ownerId);

    if (targetId.equals(ownerObjectId)) {
      throw new ConflictException('You cannot share a device with yourself');
    }

    const alreadyShared = device.sharedWith.some((id) => id.equals(targetId));
    if (alreadyShared) {
      throw new ConflictException('Device is already shared with this user');
    }

    device.sharedWith.push(targetId);
    return device.save();
  }

  /**
   * Revoca el acceso compartido de un usuario (solo el owner).
   */
  async revokeShare(
    deviceId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<DeviceDocument> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertOwnership(device, ownerId);

    const targetObjectId = new Types.ObjectId(targetUserId);
    const initialLength = device.sharedWith.length;

    device.sharedWith = device.sharedWith.filter(
      (id) => !id.equals(targetObjectId),
    );

    if (device.sharedWith.length === initialLength) {
      throw new NotFoundException('User not found in shared list');
    }

    return device.save();
  }

  // ─── Métodos internos llamados por MqttService ──────────────────────────────

  /**
   * Actualiza el estado de conexión del dispositivo desde el módulo MQTT.
   * Método público para ser consumido por MqttService.
   */
  async updateOnlineStatus(
    deviceId: string,
    isOnline: boolean,
  ): Promise<void> {
    await this.deviceModel.updateOne(
      { deviceId },
      {
        isOnline,
        lastSeen: new Date(),
        ...(isOnline && { status: 'active' }),
      },
    );
  }

  /**
   * Guarda los datos de telemetría en el histórico de MongoDB.
   */
  async saveTelemetry(deviceId: string, data: Record<string, any>): Promise<void> {
    await this.telemetryModel.create({
      deviceId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Obtiene el histórico de telemetría de un dispositivo.
   * Verifica que el usuario tenga acceso (propietario o compartido).
   */
  async getTelemetry(
    deviceId: string,
    userId: string,
    limit = 50,
  ): Promise<TelemetryDocument[]> {
    const device = await this.findByDeviceIdOrFail(deviceId);
    this.assertAccess(device, userId);

    return this.telemetryModel
      .find({ deviceId })
      .sort({ timestamp: -1 }) // Los más recientes primero
      .limit(limit)
      .exec();
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  private async findByDeviceIdOrFail(deviceId: string): Promise<DeviceDocument> {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) {
      throw new NotFoundException(`Device not found: ${deviceId}`);
    }
    return device;
  }

  private assertOwnership(device: DeviceDocument, userId: string): void {
    if (!device.ownerId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('Only the device owner can perform this action');
    }
  }

  private assertAccess(device: DeviceDocument, userId: string): void {
    const userObjectId = new Types.ObjectId(userId);
    const isOwner = device.ownerId.equals(userObjectId);
    const isShared = device.sharedWith.some((id) => id.equals(userObjectId));
    if (!isOwner && !isShared) {
      throw new ForbiddenException('You do not have access to this device');
    }
  }
}
