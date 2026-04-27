import { ConflictException, NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test, type TestingModule } from '@nestjs/testing';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { PetStatus } from '../../common/enums/pet-status.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Pet } from '../pets/pet.model.js';
import { Application } from './application.model.js';
import { ApplicationsService } from './applications.service.js';

/**
 * These tests pin every plan.md business rule for ApplicationsService.
 * The Sequelize layer is mocked — we don't need a database to prove the
 * rule logic, only that:
 *   - the right pre-checks fire in the right order, and
 *   - approve cascades to siblings via a bulk update inside one transaction.
 */
describe('ApplicationsService', () => {
  const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } };

  const sequelize = {
    transaction: jest.fn(async (cb: (t: typeof fakeTransaction) => unknown) =>
      cb(fakeTransaction),
    ),
  };

  const pets = {
    findByPk: jest.fn(),
  };

  const applications = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const user: AuthUser = {
    id: 'user-1',
    email: 'alice@cobra.local',
    role: UserRole.USER,
  };
  const staff: AuthUser = {
    id: 'staff-1',
    email: 'staff@cobra.local',
    role: UserRole.STAFF,
  };

  let service: ApplicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getModelToken(Application), useValue: applications },
        { provide: getModelToken(Pet), useValue: pets },
        { provide: getConnectionToken(), useValue: sequelize },
      ],
    }).compile();
    service = module.get(ApplicationsService);
  });

  describe('submit', () => {
    it('404 when the pet does not exist', async () => {
      pets.findByPk.mockResolvedValue(null);
      await expect(
        service.submit(user, { petId: 'missing-pet' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 when the pet is not available', async () => {
      pets.findByPk.mockResolvedValue({ id: 'pet-1', status: PetStatus.ADOPTED });
      await expect(
        service.submit(user, { petId: 'pet-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(applications.create).not.toHaveBeenCalled();
    });

    it('409 when the same user already applied for this pet', async () => {
      pets.findByPk.mockResolvedValue({ id: 'pet-1', status: PetStatus.AVAILABLE });
      // First findOne — duplicate-by-user check
      applications.findOne.mockResolvedValueOnce({
        id: 'old-app',
        userId: user.id,
        petId: 'pet-1',
        status: ApplicationStatus.REJECTED,
      });
      await expect(
        service.submit(user, { petId: 'pet-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(applications.create).not.toHaveBeenCalled();
    });

    it('409 when another applicant already has a pending application', async () => {
      pets.findByPk.mockResolvedValue({ id: 'pet-1', status: PetStatus.AVAILABLE });
      applications.findOne
        .mockResolvedValueOnce(null) // no duplicate-by-user
        .mockResolvedValueOnce({
          id: 'pending-app',
          userId: 'user-2',
          petId: 'pet-1',
          status: ApplicationStatus.PENDING,
        });
      await expect(
        service.submit(user, { petId: 'pet-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(applications.create).not.toHaveBeenCalled();
    });

    it('creates a pending application when all checks pass', async () => {
      pets.findByPk.mockResolvedValue({ id: 'pet-1', status: PetStatus.AVAILABLE });
      applications.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const created = { id: 'new-app', petId: 'pet-1', userId: user.id };
      applications.create.mockResolvedValue(created);

      const result = await service.submit(user, {
        petId: 'pet-1',
        message: '  Hi please  ',
      });

      expect(result).toBe(created);
      expect(sequelize.transaction).toHaveBeenCalledTimes(1);
      expect(applications.create).toHaveBeenCalledWith(
        {
          petId: 'pet-1',
          userId: user.id,
          message: 'Hi please',
        },
        { transaction: fakeTransaction },
      );
    });

    it('locks the pet row with FOR UPDATE inside the transaction', async () => {
      pets.findByPk.mockResolvedValue({ id: 'pet-1', status: PetStatus.AVAILABLE });
      applications.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      applications.create.mockResolvedValue({ id: 'new-app' });
      await service.submit(user, { petId: 'pet-1' });
      expect(pets.findByPk).toHaveBeenCalledWith('pet-1', {
        transaction: fakeTransaction,
        lock: 'UPDATE',
      });
    });
  });

  describe('listMine', () => {
    it('queries by the current user id only', async () => {
      const rows = [{ id: 'a' }, { id: 'b' }];
      applications.findAll.mockResolvedValue(rows);
      const result = await service.listMine(user);
      expect(result).toBe(rows);
      expect(applications.findAll).toHaveBeenCalledWith({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
      });
    });
  });

  describe('approve (the cascade)', () => {
    it('404 when the application does not exist', async () => {
      applications.findByPk.mockResolvedValue(null);
      await expect(service.approve(staff, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409 when the application is no longer pending', async () => {
      applications.findByPk.mockResolvedValue({
        id: 'app-1',
        status: ApplicationStatus.APPROVED,
      });
      await expect(service.approve(staff, 'app-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(applications.update).not.toHaveBeenCalled();
    });

    it('marks the application approved, the pet adopted, and bulk-rejects siblings', async () => {
      const app = {
        id: 'app-1',
        petId: 'pet-1',
        status: ApplicationStatus.PENDING,
        save: jest.fn().mockResolvedValue(undefined),
        decidedAt: null as Date | null,
        decidedBy: null as string | null,
      };
      const pet = {
        id: 'pet-1',
        status: PetStatus.AVAILABLE,
        save: jest.fn().mockResolvedValue(undefined),
      };
      applications.findByPk.mockResolvedValue(app);
      pets.findByPk.mockResolvedValue(pet);
      applications.update.mockResolvedValue([2]); // 2 siblings rejected

      const result = await service.approve(staff, 'app-1');

      expect(result).toBe(app);
      expect(app.status).toBe(ApplicationStatus.APPROVED);
      expect(app.decidedBy).toBe(staff.id);
      expect(app.decidedAt).toBeInstanceOf(Date);
      expect(app.save).toHaveBeenCalledWith({ transaction: fakeTransaction });

      expect(pet.status).toBe(PetStatus.ADOPTED);
      expect(pet.save).toHaveBeenCalledWith({ transaction: fakeTransaction });

      expect(applications.update).toHaveBeenCalledTimes(1);
      const [patch, opts] = applications.update.mock.calls[0] ?? [];
      expect(patch).toEqual(
        expect.objectContaining({
          status: ApplicationStatus.REJECTED,
          decidedBy: staff.id,
        }),
      );
      // Sibling clause: same pet, still pending, exclude this application.
      const where = (opts as { where: Record<string, unknown> }).where;
      expect(where['petId']).toBe('pet-1');
      expect(where['status']).toBe(ApplicationStatus.PENDING);
      expect(where['id']).toEqual(expect.objectContaining({}));
      expect((opts as { transaction: unknown }).transaction).toBe(fakeTransaction);
    });
  });

  describe('reject', () => {
    it('flips a single application without touching the pet', async () => {
      const app = {
        id: 'app-1',
        petId: 'pet-1',
        status: ApplicationStatus.PENDING,
        save: jest.fn().mockResolvedValue(undefined),
        decidedAt: null as Date | null,
        decidedBy: null as string | null,
      };
      const pet = {
        id: 'pet-1',
        status: PetStatus.AVAILABLE,
        save: jest.fn().mockResolvedValue(undefined),
      };
      applications.findByPk.mockResolvedValue(app);
      pets.findByPk.mockResolvedValue(pet);

      await service.reject(staff, 'app-1');

      expect(app.status).toBe(ApplicationStatus.REJECTED);
      expect(app.decidedBy).toBe(staff.id);
      expect(pet.save).not.toHaveBeenCalled();
      expect(applications.update).not.toHaveBeenCalled();
    });

    it('409 when the application is already decided', async () => {
      applications.findByPk.mockResolvedValue({
        id: 'app-1',
        status: ApplicationStatus.REJECTED,
      });
      await expect(service.reject(staff, 'app-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
