import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Pet } from '../pets/pet.model.js';
import { User } from '../users/user.model.js';
import {
  APPLICATION_STATUS_VALUES,
  ApplicationStatus,
} from '../../common/enums/application-status.enum.js';

export interface ApplicationCreationAttrs {
  petId: string;
  userId: string;
  message?: string | null;
  status?: ApplicationStatus;
}

@Table({
  tableName: 'adoption_applications',
  underscored: true,
  indexes: [
    { name: 'applications_user_idx', fields: ['user_id'] },
    { name: 'applications_pet_idx', fields: ['pet_id'] },
    {
      // "A user cannot apply for the same pet twice" while pending.
      // Combined with the rule below, this also prevents a user from holding
      // two open applications on the same pet at once.
      name: 'applications_unique_pending_per_user_pet',
      unique: true,
      fields: ['pet_id', 'user_id'],
      where: { status: ApplicationStatus.PENDING },
    },
    {
      // "A pet may only have one active (pending) application at a time."
      name: 'applications_unique_pending_per_pet',
      unique: true,
      fields: ['pet_id'],
      where: { status: ApplicationStatus.PENDING },
    },
  ],
})
export class Application extends Model<Application, ApplicationCreationAttrs> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Pet)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Default(ApplicationStatus.PENDING)
  @Column({
    type: DataType.ENUM(...APPLICATION_STATUS_VALUES),
    allowNull: false,
  })
  declare status: ApplicationStatus;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare message: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'decided_at' })
  declare decidedAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'decided_by' })
  declare decidedBy: string | null;

  @CreatedAt declare createdAt: Date;
  @UpdatedAt declare updatedAt: Date;

  // Deleting a pet should remove its applications — they're meaningless
  // without the listing.
  @BelongsTo(() => Pet, { foreignKey: 'petId', as: 'pet', onDelete: 'CASCADE' })
  declare pet?: Pet;

  // Deleting an applicant should remove their applications too — there's no
  // useful audit value in keeping a row whose owner is gone.
  @BelongsTo(() => User, {
    foreignKey: 'userId',
    as: 'applicant',
    onDelete: 'CASCADE',
  })
  declare applicant?: User;

  // The staff member who decided the application is audit metadata. If a
  // staff account is removed we keep the application row but clear the
  // pointer rather than cascade-deleting historical decisions.
  @BelongsTo(() => User, {
    foreignKey: 'decidedBy',
    as: 'decider',
    onDelete: 'SET NULL',
  })
  declare decider?: User | null;
}
