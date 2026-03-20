import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import {
  CreateStudentDto, CreateStudentSchema,
  UpdateStudentDto, UpdateStudentSchema,
  EnrollStudentDto, EnrollStudentSchema,
  LinkGuardianDto, LinkGuardianSchema,
} from './dto/student.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Students')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Student' })
  @ApiOperation({ summary: 'Listar alumnos de la institución' })
  findAll(@InstitutionId() institutionId: string) {
    return this.studentsService.findAll(institutionId);
  }

  @Get('my-children')
  @CheckAbility({ action: Action.Read, subject: 'Student' })
  @ApiOperation({ summary: 'Alumnos vinculados al tutor autenticado' })
  findMyChildren(@CurrentUser() user: RequestUser) {
    return this.studentsService.findByGuardian(user.id, user.institutionId!);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Student' })
  @ApiOperation({ summary: 'Obtener un alumno' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.studentsService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Student' })
  @ApiOperation({ summary: 'Crear alumno (ADMIN)' })
  create(
    @Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.studentsService.create(dto, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Student' })
  @ApiOperation({ summary: 'Actualizar alumno' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateStudentSchema)) dto: UpdateStudentDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.studentsService.update(id, dto, institutionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Student' })
  @ApiOperation({ summary: 'Eliminar alumno (soft delete)' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.studentsService.remove(id, institutionId);
  }

  @Post(':id/enroll')
  @CheckAbility({ action: Action.Create, subject: 'Student' })
  @ApiOperation({ summary: 'Matricular alumno en un curso' })
  enroll(
    @Param('id') studentId: string,
    @Body(new ZodPipe(EnrollStudentSchema)) dto: EnrollStudentDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.studentsService.enroll(studentId, dto, institutionId);
  }

  @Post(':id/guardians')
  @CheckAbility({ action: Action.Create, subject: 'Student' })
  @ApiOperation({ summary: 'Vincular tutor a un alumno' })
  linkGuardian(
    @Param('id') studentId: string,
    @Body(new ZodPipe(LinkGuardianSchema)) dto: LinkGuardianDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.studentsService.linkGuardian(studentId, dto, institutionId);
  }
}
