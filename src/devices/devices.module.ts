import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Device, DeviceSchema } from './schemas/device.schema';
import { Telemetry, TelemetrySchema } from './schemas/telemetry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: Telemetry.name, schema: TelemetrySchema },
      // Necesitamos User para buscar por email en registerDevice y shareDevice
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService], // Exportado para que MqttModule pueda llamar a updateOnlineStatus
})
export class DevicesModule {}
