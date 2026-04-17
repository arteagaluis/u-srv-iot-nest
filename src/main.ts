import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Global prefix for API
    app.setGlobalPrefix('api');

    // Enable CORS with full options for mobile/web integration
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
        credentials: true,
    });

    // Simple Logger Middleware to see incoming requests
    app.use((req, res, next) => {
        logger.log(`${req.method} ${req.url}`);
        next();
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`IoT Auth Service is running on: http://localhost:${port}/api`);
}
bootstrap();
