import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Application } from '../applications/application.model.js';
import {
  PET_STATUS_VALUES,
  PetStatus,
} from '../../common/enums/pet-status.enum.js';

export interface PetCreationAttrs {
  name: string;
  species: string;
  breed?: string | null;
  ageYears: number;
  description: string;
  status?: PetStatus;
}

@Table({
  tableName: 'pets',
  underscored: true,
  indexes: [{ name: 'pets_status_species_idx', fields: ['status', 'species'] }],
})
export class Pet extends Model<Pet, PetCreationAttrs> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare species: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare breed: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'age_years',
    validate: { min: 0 },
  })
  declare ageYears: number;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare description: string;

  @Default(PetStatus.AVAILABLE)
  @Column({
    type: DataType.ENUM(...PET_STATUS_VALUES),
    allowNull: false,
  })
  declare status: PetStatus;

  @CreatedAt declare createdAt: Date;
  @UpdatedAt declare updatedAt: Date;

  @HasMany(() => Application, { foreignKey: 'petId', as: 'applications' })
  declare applications?: Application[];
}
