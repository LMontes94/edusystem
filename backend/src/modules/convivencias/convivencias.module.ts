// src/modules/convivencias/convivencias.module.ts
import { Module } from '@nestjs/common';
import { ConvivenciasController } from './convivencias.controller';
import { ConvivenciasService } from './convivencias.service';

@Module({
  controllers: [ConvivenciasController],
  providers:   [ConvivenciasService],
  exports:     [ConvivenciasService],
})
export class ConvivenciasModule {}