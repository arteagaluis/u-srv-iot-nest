import { Types } from 'mongoose';

export interface IDevice {
  deviceId: string;
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  sharedWith: Types.ObjectId[];
  isOnline: boolean;
  status: 'pending' | 'active' | 'inactive';
  lastSeen?: Date;
  firmwareVersion?: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}
