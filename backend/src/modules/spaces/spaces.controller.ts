import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
  import { SpacesService } from './spaces.service';
  import {
    CreateSpaceDto,
    CreateSpaceSchema,
    UpdateSpaceDto,
    UpdateSpaceSchema,
  } from './dto/space.dto';
  import { InstitutionId } from '../../common/decorators/institution-id.decorator';
  import { ZodPipe } from '../../common/pipes/zod.pipe';
  import { CaslGuard } from '../casl/guards/casl.guard';
  import { CheckAbility } from '../casl/decorators/check-ability.decorator';
  import { Action } from '../casl/casl.types';
  
  @ApiTags('Spaces')
  @ApiBearerAuth('JWT')
  @UseGuards(CaslGuard)
  @Controller('spaces')
  export class SpacesController {
    constructor(private readonly spacesService: SpacesService) {}
  
    @Get()
    @CheckAbility({ action: Action.Read, subject: 'Space' })
    @ApiOperation({ summary: 'Listar espacios de la institución' })
    findAll(@InstitutionId() institutionId: string) {
      return this.spacesService.findAll(institutionId);
    }
  
    @Get(':id')
    @CheckAbility({ action: Action.Read, subject: 'Space' })
    @ApiOperation({ summary: 'Obtener un espacio' })
    findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
      return this.spacesService.findOne(id, institutionId);
    }
  
    @Post()
    @CheckAbility({ action: Action.Create, subject: 'Space' })
    @ApiOperation({ summary: 'Crear espacio (ADMIN/DIRECTOR/SECRETARY)' })
    create(
      @Body(new ZodPipe(CreateSpaceSchema)) dto: CreateSpaceDto,
      @InstitutionId() institutionId: string,
    ) {
      return this.spacesService.create(institutionId, dto);
    }
  
    @Patch(':id')
    @CheckAbility({ action: Action.Update, subject: 'Space' })
    @ApiOperation({ summary: 'Actualizar espacio' })
    update(
      @Param('id') id: string,
      @Body(new ZodPipe(UpdateSpaceSchema)) dto: UpdateSpaceDto,
      @InstitutionId() institutionId: string,
    ) {
      return this.spacesService.update(id, institutionId, dto);
    }
  
    @Patch(':id/toggle-availability')
    @CheckAbility({ action: Action.Update, subject: 'Space' })
    @ApiOperation({ summary: 'Habilitar/deshabilitar espacio' })
    toggleAvailability(
      @Param('id') id: string,
      @InstitutionId() institutionId: string,
    ) {
      return this.spacesService.toggleAvailability(id, institutionId);
    }
  
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @CheckAbility({ action: Action.Delete, subject: 'Space' })
    @ApiOperation({ summary: 'Eliminar espacio (soft delete)' })
    remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
      return this.spacesService.remove(id, institutionId);
    }
  }