import {
  Body, Controller, Delete, Get, Param,
  Post, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardiansService } from './guardians.service';
import { LinkStudentDto, LinkStudentSchema } from './dto/link-student.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Guardians')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get(':userId/students')
  @CheckAbility({ action: Action.Read, subject: 'User' })
  @ApiOperation({ summary: 'Listar alumnos vinculados a un tutor' })
  findLinkedStudents(
    @Param('userId') userId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.guardiansService.findLinkedStudents(userId, institutionId);
  }

  @Post(':userId/students')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @ApiOperation({ summary: 'Vincular un alumno a un tutor' })
  linkStudent(
    @Param('userId') userId: string,
    @Body(new ZodPipe(LinkStudentSchema)) dto: LinkStudentDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.guardiansService.linkStudent(userId, dto, institutionId, currentUser);
  }

  @Delete(':userId/students/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @ApiOperation({ summary: 'Desvincular un alumno de un tutor' })
  unlinkStudent(
    @Param('userId') userId: string,
    @Param('studentId') studentId: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.guardiansService.unlinkStudent(userId, studentId, institutionId, currentUser);
  }
}
