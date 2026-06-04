import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { EducationLevelsService } from './education-levels.service';
import { CreateEducationLevelSchema } from './dto/create-education-level.dto';
import { UpdateEducationLevelSchema } from './dto/update-education-level.dto';
import { CreateLevelGradeSchema } from './dto/create-level-grade.dto';
import { UpdateLevelGradeSchema } from './dto/update-level-grade.dto';
import type { CreateEducationLevelDto } from './dto/create-education-level.dto';
import type { UpdateEducationLevelDto } from './dto/update-education-level.dto';
import type { CreateLevelGradeDto } from './dto/create-level-grade.dto';
import type { UpdateLevelGradeDto } from './dto/update-level-grade.dto';
import type { RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('education-levels')
export class EducationLevelsController {
  constructor(private readonly service: EducationLevelsService) {}

  // ── EducationLevel CRUD ───────────────────────────────────────

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'EducationLevel' })
  findAll(@InstitutionId() institutionId: string) {
    return this.service.findAll(institutionId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'EducationLevel' })
  findOne(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'EducationLevel' })
  create(
    @Body(new ZodPipe(CreateEducationLevelSchema)) dto: CreateEducationLevelDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(dto, institutionId, user.id);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'EducationLevel' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateEducationLevelSchema)) dto: UpdateEducationLevelDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, institutionId, user.id);
  }

  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'EducationLevel' })
  delete(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.delete(id, institutionId, user.id);
  }

  // ── LevelGrade sub-resource CRUD ──────────────────────────────

  @Get(':educationLevelId/grades')
  @CheckAbility({ action: Action.Read, subject: 'LevelGrade' })
  findGrades(
    @Param('educationLevelId') educationLevelId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.findGrades(educationLevelId, institutionId);
  }

  @Post(':educationLevelId/grades')
  @CheckAbility({ action: Action.Create, subject: 'LevelGrade' })
  createGrade(
    @Param('educationLevelId') educationLevelId: string,
    @Body(new ZodPipe(CreateLevelGradeSchema)) dto: CreateLevelGradeDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createGrade(educationLevelId, dto, institutionId, user.id);
  }

  @Patch(':educationLevelId/grades/:id')
  @CheckAbility({ action: Action.Update, subject: 'LevelGrade' })
  updateGrade(
    @Param('educationLevelId') educationLevelId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateLevelGradeSchema)) dto: UpdateLevelGradeDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateGrade(
      educationLevelId,
      id,
      dto,
      institutionId,
      user.id,
    );
  }

  @Delete(':educationLevelId/grades/:id')
  @CheckAbility({ action: Action.Delete, subject: 'LevelGrade' })
  deleteGrade(
    @Param('educationLevelId') educationLevelId: string,
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteGrade(educationLevelId, id, institutionId, user.id);
  }
}
