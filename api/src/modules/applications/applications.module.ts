import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PetsModule } from '../pets/pets.module.js';
import { Application } from './application.model.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  imports: [SequelizeModule.forFeature([Application]), PetsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [SequelizeModule, ApplicationsService],
})
export class ApplicationsModule {}
