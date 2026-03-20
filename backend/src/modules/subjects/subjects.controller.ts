import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectSchema, UpdateSubjectSchema } from '../courses/dto/course.dto';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Subjects')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Subject' })
  findAll(@InstitutionId() institutionId: string) {
    return this.subjectsService.findAll(institutionId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Subject' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.subjectsService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Subject' })
  create(
    @Body(new ZodPipe(CreateSubjectSchema)) dto: any,
    @InstitutionId() institutionId: string,
  ) {
    return this.subjectsService.create(dto, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Subject' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateSubjectSchema)) dto: any,
    @InstitutionId() institutionId: string,
  ) {
    return this.subjectsService.update(id, dto, institutionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Subject' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.subjectsService.remove(id, institutionId);
  }
}
