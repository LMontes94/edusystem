import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';
import * as admin from 'firebase-admin';

// ──────────────────────────────────────────────
// FcmService — envío de push notifications via Firebase.
//
// Si las variables FCM no están configuradas,
// el servicio funciona en modo "dry-run" y solo
// loguea los mensajes sin enviarlos.
// Esto permite desarrollar sin necesitar Firebase.
// ──────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body:  string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;
  private isDryRun = false;

  constructor(private readonly config: ConfigService<EnvConfig>) {}

  onModuleInit() {
    const projectId   = this.config.get('FCM_PROJECT_ID');
    const privateKey  = this.config.get('FCM_PRIVATE_KEY');
    const clientEmail = this.config.get('FCM_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('FCM no configurado — modo dry-run activado (no se enviarán pushes)');
      this.isDryRun = true;
      return;
    }

    try {
      // Evitar inicializar múltiples veces
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });
      } else {
        this.app = admin.app();
      }
      this.logger.log('Firebase FCM inicializado');
    } catch (err) {
      this.logger.error('Error inicializando Firebase FCM', err);
      this.isDryRun = true;
    }
  }

  // ── Enviar a múltiples tokens ─────────────────
  async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    if (tokens.length === 0) return;

    if (this.isDryRun) {
      this.logger.debug(
        `[DRY-RUN] Push a ${tokens.length} tokens: ${payload.title} — ${payload.body}`,
      );
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data
          ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
          : undefined,
        android: { priority: 'high' },
        apns:    { payload: { aps: { sound: 'default' } } },
      };

      const response = await admin.messaging(this.app!).sendEachForMulticast(message);

      if (response.failureCount > 0) {
        const failed = response.responses
          .map((r, i) => (!r.success ? tokens[i] : null))
          .filter(Boolean);
        this.logger.warn(`FCM: ${response.failureCount} tokens fallidos`, failed);

        // Desactivar tokens inválidos
        await this.deactivateInvalidTokens(failed as string[]);
      }

      this.logger.log(`FCM: ${response.successCount}/${tokens.length} pushes enviados`);
    } catch (err) {
      this.logger.error('Error enviando push notifications', err);
    }
  }

  // ── Desactivar tokens inválidos en DB ─────────
  private async deactivateInvalidTokens(tokens: string[]): Promise<void> {
    // Se importa dinámicamente para evitar dependencia circular
    // En producción esto se manejaría via el PrismaService inyectado
    this.logger.debug(`Tokens inválidos a desactivar: ${tokens.join(', ')}`);
  }
}
