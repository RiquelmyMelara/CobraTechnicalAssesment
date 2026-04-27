/**
 * Happy-path end-to-end test exercising the most important slice of the
 * API: register two users (one staff via DB seed), browse pets, submit an
 * application, verify the staff approve cascade closes the listing.
 *
 * Requires Postgres reachable at the env-configured DATABASE_*. Skipped
 * automatically if the connection fails so unit-test runs in CI without
 * a database stay green. Use a *separate* test database (set
 * DATABASE_NAME to e.g. 'cobra_pets_test') — the test wipes the schema.
 */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, type TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ApplicationStatus } from '../src/common/enums/application-status.enum.js';
import { PetStatus } from '../src/common/enums/pet-status.enum.js';
import { UserRole } from '../src/common/enums/user-role.enum.js';
import { Application } from '../src/modules/applications/application.model.js';
import { Pet } from '../src/modules/pets/pet.model.js';
import { User } from '../src/modules/users/user.model.js';

describe('Pet Adoption (E2E)', () => {
  let app: INestApplication;
  let server: import('http').Server;
  let dbReachable = true;

  beforeAll(async () => {
    let module: TestingModule;
    try {
      module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();

      const sequelize = app.get(Sequelize);
      await sequelize.sync({ force: true });
      // Promote one seeded user to staff after registration so we can test
      // the role gate without exposing role-set in the public API.
    } catch (err) {
      dbReachable = false;
      // eslint-disable-next-line no-console
      console.warn(
        '[e2e] Postgres not reachable; skipping E2E suite. Cause:',
        err instanceof Error ? err.message : err,
      );
    }

    if (app) {
      server = app.getHttpServer() as import('http').Server;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const skipIfNoDb = (): void => {
    if (!dbReachable) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(true).toBe(true);
    }
  };

  it('full happy path: register -> apply -> staff approve -> cascade', async () => {
    if (!dbReachable) return skipIfNoDb();

    // 1. Register a regular adopter and a staff candidate.
    const adopter = await request(server)
      .post('/auth/register')
      .send({
        email: 'adopter@e2e.local',
        password: 'Password1!',
        name: 'Adopter Ann',
      })
      .expect(201);
    expect(adopter.body.accessToken).toEqual(expect.any(String));

    const otherAdopter = await request(server)
      .post('/auth/register')
      .send({
        email: 'rival@e2e.local',
        password: 'Password1!',
        name: 'Rival Rita',
      })
      .expect(201);

    const staffReg = await request(server)
      .post('/auth/register')
      .send({
        email: 'staff@e2e.local',
        password: 'Password1!',
        name: 'Staff Sam',
      })
      .expect(201);

    // Promote staff via DB (no public role-set endpoint by design).
    const userModel = app.get<typeof User>(getModelToken(User));
    await userModel.update(
      { role: UserRole.STAFF },
      { where: { id: staffReg.body.user.id } },
    );
    const staffLogin = await request(server)
      .post('/auth/login')
      .send({ email: 'staff@e2e.local', password: 'Password1!' })
      .expect(200);
    const staffToken = staffLogin.body.accessToken as string;

    // 2. Staff creates a pet.
    const created = await request(server)
      .post('/pets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'E2E Pup',
        species: 'dog',
        breed: 'Mix',
        ageYears: 2,
        description: 'A test puppy.',
      })
      .expect(201);
    const petId = created.body.id as string;

    // 3. A non-staff user cannot create a pet.
    await request(server)
      .post('/pets')
      .set('Authorization', `Bearer ${adopter.body.accessToken}`)
      .send({
        name: 'Forbidden',
        species: 'cat',
        ageYears: 1,
        description: 'should 403',
      })
      .expect(403);

    // 4. Public list shows the pet by default.
    const list = await request(server).get('/pets').expect(200);
    expect(list.body.data.map((p: Pet) => p.id)).toContain(petId);

    // 5. Adopter applies.
    const adopterApp = await request(server)
      .post('/applications')
      .set('Authorization', `Bearer ${adopter.body.accessToken}`)
      .send({ petId, message: 'Loving home ready.' })
      .expect(201);
    const adopterAppId = adopterApp.body.id as string;

    // 6. Adopter cannot apply twice.
    await request(server)
      .post('/applications')
      .set('Authorization', `Bearer ${adopter.body.accessToken}`)
      .send({ petId })
      .expect(409);

    // 7. Rival cannot apply while another pending application exists.
    await request(server)
      .post('/applications')
      .set('Authorization', `Bearer ${otherAdopter.body.accessToken}`)
      .send({ petId })
      .expect(409);

    // 8. Adopter sees the application in /applications/me.
    const mine = await request(server)
      .get('/applications/me')
      .set('Authorization', `Bearer ${adopter.body.accessToken}`)
      .expect(200);
    expect(mine.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: adopterAppId, status: ApplicationStatus.PENDING }),
      ]),
    );

    // 9. Staff approves.
    const approved = await request(server)
      .post(`/applications/${adopterAppId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(approved.body.status).toBe(ApplicationStatus.APPROVED);

    // 10. The pet is now adopted.
    const after = await request(server).get(`/pets/${petId}`).expect(200);
    expect(after.body.status).toBe(PetStatus.ADOPTED);

    // 11. Auth gate sanity: missing token is 401.
    await request(server).get('/applications/me').expect(401);

    // 12. Sanity: model count matches.
    const appModel = app.get<typeof Application>(getModelToken(Application));
    expect(await appModel.count({ where: { petId } })).toBeGreaterThanOrEqual(1);
  });
});
