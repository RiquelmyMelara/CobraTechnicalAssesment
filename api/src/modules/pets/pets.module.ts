import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Pet } from './pet.model.js';

@Module({
  imports: [SequelizeModule.forFeature([Pet])],
  exports: [SequelizeModule],
})
export class PetsModule {}
