import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// ──────────────────────────────────────────────
// Bootstrap dual-mode:
//
//   APP_MODE=api    → levanta HTTP server (default)
//   APP_MODE=worker → solo inicializa BullMQ processors
//
// El mismo Dockerfile sirve para ambos.
// Ver docker-compose.yml: service "worker" usa APP_MODE=worker.
// ──────────────────────────────────────────────

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suprimir logs de NestJS en favor del Logger propio
    bufferLogs: true,
  });

  const mode = process.env.APP_MODE ?? 'api';

  // ── Modo Worker ──────────────────────────────
  if (mode === 'worker') {
    await app.init();
    logger.log('Worker BullMQ iniciado — esperando jobs');
    logger.log(`Colas: notifications | pdf-generation | audit-log | grade-processing`);

    // Mantener proceso vivo
    process.on('SIGTERM', async () => {
      logger.log('Worker deteniendo...');
      await app.close();
    });

    return;
  }

  // ── Modo API ─────────────────────────────────
  const port = process.env.PORT ?? 4000;
  const isDev = process.env.NODE_ENV === 'development';

  // Prefijo global → /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Filtro global de excepciones
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Swagger — solo en desarrollo
  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('EduSystem API')
      .setDescription('API REST para gestión educativa multi-tenant')
      .setVersion('2.1')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .addTag('Health', 'Estado de la API')
      .addTag('Auth', 'Autenticación y tokens')
      .addTag('Institutions', 'Gestión de instituciones')
      .addTag('Users', 'Gestión de usuarios')
      .addTag('Students', 'Alumnos')
      .addTag('Grades', 'Calificaciones')
      .addTag('Attendance', 'Asistencia')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger disponible en http://localhost:${port}/docs`);
  }

  await app.listen(port);

  logger.log(`API corriendo en http://localhost:${port}/api/v1`);
  logger.log(`Health: http://localhost:${port}/api/v1/health`);
  logger.log(`Modo: ${isDev ? 'desarrollo' : 'producción'}`);
}

bootstrap().catch((err) => {
  logger.error('Error fatal en bootstrap:', err);
  process.exit(1);
});
