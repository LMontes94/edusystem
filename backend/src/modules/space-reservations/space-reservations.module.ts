import { Module } from '@nestjs/common';
import { SpaceReservationsService } from './space-reservations.service';
import { SpaceReservationsController } from './space-reservations.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SpaceReservationsController],
  providers: [SpaceReservationsService],
})
export class SpaceReservationsModule {}