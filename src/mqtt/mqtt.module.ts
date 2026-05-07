import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { MqttService } from './mqtt.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [DevicesModule, EventsModule], // Importa DevicesModule para inyectar DevicesService y EventsModule para el Gateway
  providers: [MqttService],
  exports: [MqttService],   // Exportado por si otros módulos necesitan publicar mensajes
})
export class MqttModule {}
