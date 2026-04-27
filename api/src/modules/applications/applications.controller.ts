import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Application } from './application.model.js';
import {
  ApplicationsService,
  type PaginatedApplications,
} from './applications.service.js';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto.js';
import { SubmitApplicationDto } from './dto/submit-application.dto.js';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitApplicationDto,
  ): Promise<Application> {
    return this.applications.submit(user, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthUser): Promise<Application[]> {
    return this.applications.listMine(user);
  }

  @Get()
  @Roles(UserRole.STAFF)
  listAll(
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplications> {
    return this.applications.listAll(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Application> {
    return this.applications.approve(user, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Application> {
    return this.applications.reject(user, id);
  }
}
