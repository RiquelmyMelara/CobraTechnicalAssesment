import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, type Transaction } from 'sequelize';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { PetStatus } from '../../common/enums/pet-status.enum.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Pet } from '../pets/pet.model.js';
import { Application } from './application.model.js';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto.js';
import { SubmitApplicationDto } from './dto/submit-application.dto.js';

export interface PaginatedApplications {
  data: Application[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectModel(Application) private readonly applications: typeof Application,
    @InjectModel(Pet) private readonly pets: typeof Pet,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  /**
   * Submit a new application. Enforces the three plan.md rules:
   *  1. The pet must exist and be `available`.
   *  2. A user cannot apply for the same pet twice (regardless of past
   *     application status).
   *  3. A pet may only have one `pending` application at a time.
   *
   * Locks the pet row inside a transaction so two concurrent submissions
   * on the same pet can't race past the checks.
   */
  async submit(
    user: AuthUser,
    dto: SubmitApplicationDto,
  ): Promise<Application> {
    return this.sequelize.transaction(async (t) => {
      const pet = await this.pets.findByPk(dto.petId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!pet) {
        throw new NotFoundException(`Pet ${dto.petId} not found`);
      }
      if (pet.status !== PetStatus.AVAILABLE) {
        throw new ConflictException(
          'This pet is no longer available for adoption.',
        );
      }

      const previous = await this.applications.findOne({
        where: { petId: pet.id, userId: user.id },
        transaction: t,
      });
      if (previous) {
        throw new ConflictException('You have already applied to this pet.');
      }

      const otherPending = await this.applications.findOne({
        where: { petId: pet.id, status: ApplicationStatus.PENDING },
        transaction: t,
      });
      if (otherPending) {
        throw new ConflictException(
          'Another applicant is already pending review for this pet.',
        );
      }

      const created = await this.applications.create(
        {
          petId: pet.id,
          userId: user.id,
          message: dto.message?.trim() ?? null,
        },
        { transaction: t },
      );
      this.logger.log(
        `Application ${created.id} submitted by ${user.id} for pet ${pet.id}`,
      );
      return created;
    });
  }

  async listMine(user: AuthUser): Promise<Application[]> {
    return this.applications.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Staff-only listing across every applicant. Filters and paginates.
   */
  async listAll(
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplications> {
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.petId) where['petId'] = query.petId;

    const { rows, count } = await this.applications.findAndCountAll({
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

  /**
   * Approve an application: mark pet adopted and cascade-reject every other
   * pending application on the same pet. All writes happen in one
   * transaction with the pet row locked.
   */
  async approve(staff: AuthUser, applicationId: string): Promise<Application> {
    return this.sequelize.transaction(async (t) =>
      this.decide(staff, applicationId, ApplicationStatus.APPROVED, t),
    );
  }

  async reject(staff: AuthUser, applicationId: string): Promise<Application> {
    return this.sequelize.transaction(async (t) =>
      this.decide(staff, applicationId, ApplicationStatus.REJECTED, t),
    );
  }

  private async decide(
    staff: AuthUser,
    applicationId: string,
    decision:
      | typeof ApplicationStatus.APPROVED
      | typeof ApplicationStatus.REJECTED,
    t: Transaction,
  ): Promise<Application> {
    const application = await this.applications.findByPk(applicationId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException(
        `Application is already ${application.status}; cannot change.`,
      );
    }

    const pet = await this.pets.findByPk(application.petId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!pet) {
      // Should be unreachable given FK + cascade, but guard anyway.
      throw new NotFoundException(`Pet ${application.petId} not found`);
    }

    const decidedAt = new Date();
    application.status = decision;
    application.decidedAt = decidedAt;
    application.decidedBy = staff.id;
    await application.save({ transaction: t });

    if (decision === ApplicationStatus.APPROVED) {
      pet.status = PetStatus.ADOPTED;
      await pet.save({ transaction: t });

      // Cascade-reject every other pending application for this pet.
      const [siblingsRejected] = await this.applications.update(
        {
          status: ApplicationStatus.REJECTED,
          decidedAt,
          decidedBy: staff.id,
        },
        {
          where: {
            petId: pet.id,
            status: ApplicationStatus.PENDING,
            id: { [Op.ne]: application.id },
          },
          transaction: t,
        },
      );
      this.logger.log(
        `Application ${application.id} approved by ${staff.id}; ` +
          `${siblingsRejected} sibling application(s) auto-rejected; ` +
          `pet ${pet.id} -> adopted`,
      );
    } else {
      this.logger.log(`Application ${application.id} rejected by ${staff.id}`);
    }

    return application;
  }
}
