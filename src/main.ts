import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const isProduction = configService.get('NODE_ENV') === 'production';

    // Global prefix for API
    app.setGlobalPrefix('api');

    // Security headers
    app.use(helmet());

    // Gzip compression
    app.use(compression());

    // CORS configuration
    const corsOrigins = configService.get<string>('CORS_ORIGINS');
    app.enableCors({
        origin: isProduction
            ? corsOrigins?.split(',').map((o) => o.trim()) || false
            : true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
        credentials: true,
    });

    // Request logger (only in development)
    if (!isProduction) {
        app.use((req, _res, next) => {
            logger.log(`${req.method} ${req.url}`);
            next();
        });
    }

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Graceful shutdown hooks
    app.enableShutdownHooks();

    const port = configService.get<number>('PORT') || 3000;
    await app.listen(port);

    logger.log(
        `IoT Auth Service running on port ${port} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`,
    );
}
bootstrap();
