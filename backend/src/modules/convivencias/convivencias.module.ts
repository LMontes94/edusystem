// src/modules/convivencias/convivencias.module.ts
import { Module } from '@nestjs/common';
import { ConvivenciasController } from './convivencias.controller';
import { ConvivenciasService } from './convivencias.service';
import { NotificationsModule } from '../notifications/notifications.module'; 
@Module({
  controllers: [ConvivenciasController],
  providers:   [ConvivenciasService],
  exports:     [ConvivenciasService],
  imports:  [NotificationsModule],
})
export class ConvivenciasModule {}