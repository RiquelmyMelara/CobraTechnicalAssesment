/**
 * Seed script — drops & recreates the schema, then inserts sample data so a
 * reviewer can `npm run seed && npm run start:dev` and immediately explore
 * every endpoint, including the approve-cascade.
 *
 * Run with:  npm run seed
 *
 * NEVER run against a non-dev database. The script aborts if NODE_ENV is
 * 'production'.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { Sequelize } from 'sequelize-typescript';
import { AppModule } from '../app.module.js';
import { ApplicationStatus } from '../common/enums/application-status.enum.js';
import { PetStatus } from '../common/enums/pet-status.enum.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { Application } from '../modules/applications/application.model.js';
import { Pet } from '../modules/pets/pet.model.js';
import { User } from '../modules/users/user.model.js';

interface PetSeed {
  name: string;
  species: string;
  breed: string;
  ageYears: number;
  description: string;
  status?: PetStatus;
}

const PET_SEEDS: ReadonlyArray<PetSeed> = [
  { name: 'Luna', species: 'dog', breed: 'Border Collie', ageYears: 2,
    description: 'Energetic, loves fetch and long walks.' },
  { name: 'Milo', species: 'cat', breed: 'Tabby', ageYears: 4,
    description: 'Lap cat, judgmental, perfect.' },
  { name: 'Nala', species: 'dog', breed: 'Labrador Mix', ageYears: 5,
    description: 'Calm and great with kids.' },
  { name: 'Ozzy', species: 'rabbit', breed: 'Holland Lop', ageYears: 1,
    description: 'Soft, curious, eats too much spinach.' },
  { name: 'Pip', species: 'parrot', breed: 'Cockatiel', ageYears: 3,
    description: 'Whistles the chorus of Take On Me.' },
  { name: 'Rex', species: 'dog', breed: 'Mutt', ageYears: 7,
    description: 'Senior gent. Naps, snacks, and gentle strolls.' },
  { name: 'Sage', species: 'cat', breed: 'Domestic Shorthair', ageYears: 2,
    description: 'Black-and-white tuxedo, formal at all times.' },
  { name: 'Tia', species: 'dog', breed: 'Beagle', ageYears: 3,
    description: 'Nose first, brain second.' },
  { name: 'Uma', species: 'cat', breed: 'Siamese', ageYears: 6,
    description: 'Already adopted — example of a closed listing.',
    status: PetStatus.ADOPTED },
  { name: 'Vincent', species: 'rabbit', breed: 'Mini Rex', ageYears: 2,
    description: 'Polite, occasionally disapproves.' },
];

async function seed(): Promise<void> {
  const logger = new Logger('Seed');

  if (process.env['NODE_ENV'] === 'production') {
    logger.error('Refusing to run seed against NODE_ENV=production.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const sequelize = app.get(Sequelize);
    const users = app.get<typeof User>(getModelToken(User));
    const pets = app.get<typeof Pet>(getModelToken(Pet));
    const applications = app.get<typeof Application>(getModelToken(Application));

    logger.log('Dropping and recreating schema…');
    await sequelize.sync({ force: true });

    const passwordHash = await bcrypt.hash('Password1!', 10);

    logger.log('Seeding users…');
    await users.create({
      email: 'staff@cobra.local',
      passwordHash,
      name: 'Staff Steve',
      role: UserRole.STAFF,
    });
    const alice = await users.create({
      email: 'alice@cobra.local',
      passwordHash,
      name: 'Alice Adopter',
    });
    const bob = await users.create({
      email: 'bob@cobra.local',
      passwordHash,
      name: 'Bob Boop',
    });
    const carol = await users.create({
      email: 'carol@cobra.local',
      passwordHash,
      name: 'Carol Cuddles',
    });

    logger.log('Seeding pets…');
    const petByName = new Map<string, Pet>();
    for (const seed of PET_SEEDS) {
      const created = await pets.create({
        name: seed.name,
        species: seed.species,
        breed: seed.breed,
        ageYears: seed.ageYears,
        description: seed.description,
        ...(seed.status ? { status: seed.status } : {}),
      });
      petByName.set(seed.name, created);
    }
    const pet = (name: string): Pet => {
      const found = petByName.get(name);
      if (!found) throw new Error(`Seed pet '${name}' not created`);
      return found;
    };

    logger.log('Seeding applications…');
    // One pending application on Luna so the reviewer can hit
    // POST /applications/<id>/approve and watch the cascade.
    await applications.create({
      petId: pet('Luna').id,
      userId: alice.id,
      message: 'Long walks and a fenced yard waiting for Luna.',
    });
    await applications.create({
      petId: pet('Nala').id,
      userId: bob.id,
      message: "Looking for a calm dog great with my kids.",
    });
    await applications.create({
      petId: pet('Milo').id,
      userId: carol.id,
      message: 'I have a sunny windowsill and lots of attention.',
    });
    // An already-rejected application so the reviewer can see the closed state.
    await applications.create({
      petId: pet('Pip').id,
      userId: alice.id,
      status: ApplicationStatus.REJECTED,
      message: 'Withdrawn before review.',
    });

    const lunaApp = await applications.findOne({
      where: { petId: pet('Luna').id, status: ApplicationStatus.PENDING },
    });

    logger.log('Seed summary:');
    logger.log(`  users:        ${await users.count()}`);
    logger.log(`  pets:         ${await pets.count()}`);
    logger.log(`  applications: ${await applications.count()}`);
    logger.log('');
    logger.log('Login as staff:    staff@cobra.local / Password1!');
    logger.log('Login as user:     alice@cobra.local / Password1!');
    if (lunaApp) {
      logger.log(`Try approving:     POST /applications/${lunaApp.id}/approve`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((err: unknown) => {
  // Top-level fatal — Nest's logger may not be available.
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
