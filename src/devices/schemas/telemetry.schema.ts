import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TelemetryDocument = HydratedDocument<Telemetry>;

@Schema({ timestamps: true })
export class Telemetry {
  @Prop({ required: true, index: true })
  deviceId: string;

  /** Datos del sensor (ej: { temp: 24, humidity: 60 }) */
  @Prop({ type: Object, required: true })
  data: Record<string, any>;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);

// Índice TTL opcional: para borrar telemetría antigua automáticamente después de 30 días
// TelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
