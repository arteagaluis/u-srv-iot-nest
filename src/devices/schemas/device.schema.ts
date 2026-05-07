import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  /** MAC Address del ESP8266 — identificador único físico */
  @Prop({ required: true, unique: true, index: true })
  deviceId: string;

  /** Nombre amigable definido por el usuario */
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  /** Usuario propietario del dispositivo */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId: Types.ObjectId;

  /** Usuarios con acceso compartido (N:M) */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  sharedWith: Types.ObjectId[];

  /** Estado de conexión — actualizado por el módulo MQTT */
  @Prop({ default: false })
  isOnline: boolean;

  /**
   * pending  → registrado pero sin primer heartbeat
   * active   → conectado y enviando telemetría
   * inactive → sin actividad prolongada
   */
  @Prop({ default: 'pending', enum: ['pending', 'active', 'inactive'] })
  status: 'pending' | 'active' | 'inactive';

  /** Último heartbeat recibido desde EMQX */
  @Prop()
  lastSeen?: Date;

  @Prop()
  firmwareVersion?: string;

  /** Datos extra del dispositivo (libre, para extensibilidad futura) */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
