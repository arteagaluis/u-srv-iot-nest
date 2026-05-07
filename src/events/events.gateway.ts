import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGINS?.split(',').map((o) => o.trim())
      : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSockets Gateway initialized with CORS protection');
  }

  async handleConnection(client: Socket) {
    try {
      // 1. Extraer el token del handshake (puede venir en headers o query)
      const token = this.extractToken(client);
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided. Client: ${client.id}`);
        client.disconnect();
        return;
      }

      // 2. Validar el JWT
      const payload = await this.jwtService.verifyAsync(token);
      
      // 3. Adjuntar el usuario al socket para uso futuro
      client.data.user = payload;
      
      this.logger.log(`Client authenticated: ${payload.email} (ID: ${client.id})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token. Client: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | null {
    // Intentar extraer de headers (Authorization: Bearer <token>)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }

    // Intentar extraer de query parameter (útil para clientes que no soportan headers personalizados en WS)
    const queryToken = client.handshake.query.token;
    if (queryToken) {
      return queryToken as string;
    }

    return null;
  }
}
