import { Types } from 'mongoose';

export interface ISharedUser {
  _id: string | Types.ObjectId;
  email: string;
  name: string;
  picture?: string;
}

export interface IDevice {
  deviceId: string;
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  sharedWith: Types.ObjectId[] | ISharedUser[];
  isOnline: boolean;
  status: 'pending' | 'active' | 'inactive';
  lastSeen?: Date;
  firmwareVersion?: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Extiende IDevice con un campo calculado que indica si el usuario
 * autenticado que realiza la consulta es el propietario del dispositivo.
 * - isOwner: true  → puede editar, eliminar y compartir
 * - isOwner: false → solo puede ver y monitorear
 */
export interface IDeviceWithRole extends IDevice {
  isOwner: boolean;
}
