import { Module }               from '@nestjs/common';
import { SportGroupsService }    from './sport-groups.service';
import { SportGroupsController } from './sport-groups.controller';
import { PrismaModule }          from '../../prisma/prisma.module';
import { AttendanceModule }      from '../attendance/attendance.module';

@Module({
  imports:     [PrismaModule, AttendanceModule],
  controllers: [SportGroupsController],
  providers:   [SportGroupsService],
  exports:     [SportGroupsService],
})
export class SportGroupsModule {}