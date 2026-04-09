import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  const allowedOrigins =
    configService
      .get<string>('ALLOWED_ORIGINS')
      ?.split(',')
      .filter(Boolean) || [];
  const corsMethods =
    configService
      .get<string>('CORS_METHODS', 'GET,POST,PUT,PATCH,DELETE')
      ?.split(',')
      .map((m) => m.trim()) || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const corsHeaders =
    configService
      .get<string>('CORS_HEADERS', 'Content-Type,Authorization')
      ?.split(',')
      .map((h) => h.trim()) || ['Content-Type', 'Authorization'];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: configService.get<boolean>('CORS_CREDENTIALS', true),
    methods: corsMethods,
    allowedHeaders: corsHeaders,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('WS-SERV-SPECS')
      .setDescription(
        'Service de gestion des specifications WakaSpecs - modeles, editeur IA, versioning',
      )
      .setVersion('0.1.0')
      .addTag('health', 'Health check endpoints')
      .addTag('templates', 'CRUD modeles de specification')
      .addTag('specifications', 'Gestion des specifications (instances editeur)')
      .addTag('ai', 'Redaction assistee par IA Claude')
      .addApiKey(
        { type: 'apiKey', name: 'x-api-key', in: 'header' },
        'api-key',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get<number>('PORT', 3014);
  await app.listen(port);

  logger.log(`ws-serv-specs v0.1.0 - listening on port ${port}`);
  if (!isProduction) {
    logger.log(
      `Swagger documentation available at http://localhost:${port}/api/docs`,
    );
  }
}
bootstrap();
