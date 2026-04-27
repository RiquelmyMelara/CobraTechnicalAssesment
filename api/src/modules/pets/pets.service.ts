import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type WhereOptions } from 'sequelize';
import { PetStatus } from '../../common/enums/pet-status.enum.js';
import { Pet } from './pet.model.js';
import { CreatePetDto } from './dto/create-pet.dto.js';
import { ListPetsQueryDto } from './dto/list-pets-query.dto.js';
import { UpdatePetDto } from './dto/update-pet.dto.js';

export interface PaginatedPets {
  data: Pet[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class PetsService {
  constructor(@InjectModel(Pet) private readonly pets: typeof Pet) {}

  async list(query: ListPetsQueryDto): Promise<PaginatedPets> {
    const where: WhereOptions<Pet> = {};
    if (query.status) where.status = query.status;
    if (query.species) where.species = { [Op.iLike]: query.species };

    const { rows, count } = await this.pets.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });

    return {
      data: rows,
      page: query.page,
      pageSize: query.pageSize,
      total: count,
    };
  }

  async findById(id: string): Promise<Pet> {
    const pet = await this.pets.findByPk(id);
    if (!pet) {
      throw new NotFoundException(`Pet ${id} not found`);
    }
    return pet;
  }

  async create(dto: CreatePetDto): Promise<Pet> {
    return this.pets.create({
      name: dto.name.trim(),
      species: dto.species.trim().toLowerCase(),
      breed: dto.breed?.trim() ?? null,
      ageYears: dto.ageYears,
      description: dto.description.trim(),
    });
  }

  async update(id: string, dto: UpdatePetDto): Promise<Pet> {
    const pet = await this.findById(id);

    if (
      dto.status !== undefined &&
      dto.status !== pet.status &&
      pet.status === PetStatus.ADOPTED
    ) {
      // Once a pet is adopted, the listing is closed for good. Reopening
      // would orphan whatever applications were auto-rejected when the
      // approval cascade fired.
      throw new ConflictException(
        'Adopted pets cannot be returned to another status.',
      );
    }

    if (dto.name !== undefined) pet.name = dto.name.trim();
    if (dto.species !== undefined)
      pet.species = dto.species.trim().toLowerCase();
    if (dto.breed !== undefined)
      pet.breed = dto.breed === null ? null : dto.breed.trim();
    if (dto.ageYears !== undefined) pet.ageYears = dto.ageYears;
    if (dto.description !== undefined) pet.description = dto.description.trim();
    if (dto.status !== undefined) pet.status = dto.status;

    await pet.save();
    return pet;
  }
}
