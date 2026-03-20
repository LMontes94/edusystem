import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WorkerAppModule } from './worker-app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const mode = process.env.APP_MODE ?? 'api';

  // ── Modo Worker ──────────────────────────────
  if (mode === 'worker') {
    const app = await NestFactory.create(WorkerAppModule, { bufferLogs: true });
    await app.init();
    logger.log('Worker BullMQ iniciado — procesando colas:');
    logger.log('  • notifications');
    logger.log('  • audit-log');
    logger.log('  • grade-processing');

    process.on('SIGTERM', async () => {
      logger.log('Worker deteniendo...');
      await app.close();
    });
    return;
  }

  // ── Modo API ─────────────────────────────────
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port  = process.env.PORT ?? 4000;
  const isDev = process.env.NODE_ENV === 'development';

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',').map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('EduSystem API')
      .setDescription('API REST para gestión educativa multi-tenant')
      .setVersion('2.1')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger: http://localhost:${port}/docs`);
  }

  await app.listen(port);
  logger.log(`API corriendo en http://localhost:${port}/api/v1`);
  logger.log(`Modo: ${isDev ? 'desarrollo' : 'producción'}`);
}

bootstrap().catch((err) => {
  logger.error('Error fatal en bootstrap:', err);
  process.exit(1);
});
