import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { DevicesService } from '../devices/devices.service';
import { EventsGateway } from '../events/events.gateway';

interface ProvisionPayload {
  deviceId: string;
  ownerEmail: string;
  firmwareVersion?: string;
  name?: string;
}

interface StatusPayload {
  online: boolean;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient;
  private readonly logger = new Logger(MqttService.name);
  private lastTelemetrySaveMap = new Map<string, number>();
  private readonly THROTTLE_TIME_MS = 60 * 60 * 1000; // 1 hora en milisegundos

  constructor(
    private readonly configService: ConfigService,
    private readonly devicesService: DevicesService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Se conecta al broker EMQX y suscribe a los topics al iniciar el módulo.
   * Usa onModuleInit para garantizar que todas las dependencias están listas.
   */
  onModuleInit() {
    const brokerUrl = this.configService.get<string>(
      'EMQX_BROKER_URL',
      'mqtt://localhost:1883',
    );
    const username = this.configService.get<string>('EMQX_USERNAME');
    const password = this.configService.get<string>('EMQX_PASSWORD');

    this.client = mqtt.connect(brokerUrl, {
      clientId: `iot-backend-${Date.now()}`,
      username,
      password,
      reconnectPeriod: 5000,  // Reconectar automáticamente cada 5s si cae
      connectTimeout: 10000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to EMQX broker at ${brokerUrl}`);
      this.subscribeToTopics();
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to EMQX broker...');
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT connection error: ${err.message}`);
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload).catch((err) => {
        this.logger.error(`Error handling MQTT message on topic "${topic}": ${err.message}`);
      });
    });
  }

  /**
   * Desconecta limpiamente del broker al apagar el servicio.
   * Garantiza zero-downtime en deployments (devops-graceful-shutdown).
   */
  onModuleDestroy() {
    if (this.client?.connected) {
      this.client.end(true, () => {
        this.logger.log('MQTT client disconnected gracefully');
      });
    }
  }

  /**
   * Suscribe a los topics necesarios para el sistema de provisioning y estado.
   *
   * Topics:
   *   teliot/+/provision  → ESP8266 anuncia su existencia (primer arranque)
   *   teliot/+/status     → ESP8266 publica estado online/offline
   */
  private subscribeToTopics() {
    const topics = ['teliot/+/provision', 'teliot/+/status', 'teliot/+/telemetry'];

    this.client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(`Failed to subscribe to topics: ${err.message}`);
      } else {
        this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
      }
    });
  }

  /**
   * Router de mensajes entrantes por topic.
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const parts = topic.split('/');
    // Formato esperado: teliot/{deviceId}/{event}
    if (parts.length !== 3 || parts[0] !== 'teliot') return;

    const [, deviceId, event] = parts;
    let data: unknown;

    try {
      data = JSON.parse(payload.toString());
    } catch {
      this.logger.warn(`Non-JSON payload on topic "${topic}" — ignored`);
      return;
    }

    switch (event) {
      case 'provision':
        await this.handleProvision(deviceId, data as ProvisionPayload);
        break;
      case 'status':
        await this.handleStatus(deviceId, data as StatusPayload);
        break;
      case 'telemetry':
        await this.handleTelemetry(deviceId, data as Record<string, unknown>);
        break;
      default:
        this.logger.debug(`Unhandled event type: "${event}" on deviceId: "${deviceId}"`);
    }
  }

  /**
   * Maneja el evento de provisioning: registra el dispositivo en la DB.
   * Equivalente al POST /devices/register pero vía MQTT.
   */
  private async handleProvision(
    deviceId: string,
    payload: ProvisionPayload,
  ): Promise<void> {
    this.logger.log(`Provision event received for device: ${deviceId}`);
    try {
      await this.devicesService.registerDevice({
        deviceId: payload.deviceId ?? deviceId,
        ownerEmail: payload.ownerEmail,
        name: payload.name ?? `Device ${deviceId.slice(-5)}`,
        firmwareVersion: payload.firmwareVersion,
      });

      // ACK al dispositivo: confirma que fue registrado
      this.publish(`teliot/${deviceId}/config`, { registered: true });
    } catch (err) {
      this.logger.error(
        `Failed to register device "${deviceId}" via MQTT: ${(err as Error).message}`,
      );
      this.publish(`teliot/${deviceId}/config`, {
        registered: false,
        error: (err as Error).message,
      });
    }
  }

  private async handleStatus(
    deviceId: string,
    payload: StatusPayload,
  ): Promise<void> {
    this.logger.debug(
      `Status event: device "${deviceId}" is ${payload.online ? 'ONLINE' : 'OFFLINE'}`,
    );
    try {
      await this.devicesService.updateOnlineStatus(deviceId, payload.online);
      
      // Emitimos el evento hacia el frontend a través de Socket.io
      this.eventsGateway.server.emit('device:status', {
        deviceId,
        online: payload.online,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to update status for device "${deviceId}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Maneja el evento de telemetría: guarda en DB y propaga a Next.js por Socket.io.
   */
  private async handleTelemetry(
    deviceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // 1. Propagación instantánea al frontend vía Socket.io (SIEMPRE ocurre)
    this.eventsGateway.server.emit('device:telemetry', {
      deviceId,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    // 2. Throttling para guardar en BD (solo 1 vez por hora)
    const now = Date.now();
    const lastSaveTime = this.lastTelemetrySaveMap.get(deviceId) || 0;

    if (now - lastSaveTime >= this.THROTTLE_TIME_MS) {
      try {
        await this.devicesService.saveTelemetry(deviceId, payload);
        this.lastTelemetrySaveMap.set(deviceId, now);
        this.logger.debug(`Telemetry saved to DB for device "${deviceId}" (Throttled)`);
      } catch (err) {
        this.logger.error(
          `Failed to save telemetry to DB for device "${deviceId}": ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Publica un mensaje JSON en un topic MQTT.
   * Puede ser usado por otros servicios en el futuro (ej: enviar config al device).
   */
  publish(topic: string, payload: Record<string, unknown>): void {
    if (!this.client?.connected) {
      this.logger.warn(`Cannot publish to "${topic}" — client not connected`);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }
}
