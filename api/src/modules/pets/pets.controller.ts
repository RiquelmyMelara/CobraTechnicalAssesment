import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CreatePetDto } from './dto/create-pet.dto.js';
import { ListPetsQueryDto } from './dto/list-pets-query.dto.js';
import { UpdatePetDto } from './dto/update-pet.dto.js';
import { Pet } from './pet.model.js';
import { PaginatedPets, PetsService } from './pets.service.js';

@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  list(@Query() query: ListPetsQueryDto): Promise<PaginatedPets> {
    return this.pets.list(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Pet> {
    return this.pets.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  create(@Body() dto: CreatePetDto): Promise<Pet> {
    return this.pets.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePetDto,
  ): Promise<Pet> {
    return this.pets.update(id, dto);
  }
}
