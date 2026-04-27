import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Pet } from './pet.model.js';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

@Module({
  imports: [SequelizeModule.forFeature([Pet])],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [SequelizeModule, PetsService],
})
export class PetsModule {}
