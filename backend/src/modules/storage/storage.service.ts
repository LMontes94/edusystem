import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { EnvConfig } from '../../config/env.schema';

// ──────────────────────────────────────────────
// StorageService — integración con MinIO S3
// Maneja subida, descarga y eliminación de archivos
// ──────────────────────────────────────────────

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly config: ConfigService<EnvConfig>) {}

  async onModuleInit() {
    this.bucket = this.config.get('MINIO_BUCKET') ?? 'edusystem';

    this.client = new Minio.Client({
      endPoint:  this.config.get('MINIO_ENDPOINT') ?? 'localhost',
      port:      Number(this.config.get('MINIO_PORT') ?? 9000),
      useSSL:    this.config.get('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY') ?? 'edusystem_access',
      secretKey: this.config.get('MINIO_SECRET_KEY') ?? 'edusystem_secret_key_change_me',
    });

    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket '${this.bucket}' creado`);
      } else {
        this.logger.log(`Bucket '${this.bucket}' OK`);
      }
    } catch (err) {
      this.logger.error('Error verificando bucket MinIO', err);
    }
  }

  // ── Subir archivo ─────────────────────────
  async uploadFile(
    folder: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    const objectName = `${folder}/${filename}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      buffer.length,
      { 'Content-Type': mimetype },
    );

    return objectName;
  }

  // ── Obtener URL pública ───────────────────
  async getFileUrl(objectName: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expiresIn);
  }

  // ── Eliminar archivo ─────────────────────
  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (err) {
      this.logger.warn(`No se pudo eliminar ${objectName}:`, err);
    }
  }

  // ── Generar nombre único ──────────────────
  generateFilename(originalname: string): string {
    const ext  = originalname.split('.').pop();
    const uuid = crypto.randomUUID();
    return `${uuid}.${ext}`;
  }
}