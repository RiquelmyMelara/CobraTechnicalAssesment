import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Application } from './application.model.js';

@Module({
  imports: [SequelizeModule.forFeature([Application])],
  exports: [SequelizeModule],
})
export class ApplicationsModule {}
