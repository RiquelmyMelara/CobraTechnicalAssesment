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
  USER_ROLE_VALUES,
  UserRole,
} from '../../common/enums/user-role.enum.js';

export interface UserCreationAttrs {
  email: string;
  passwordHash: string;
  name: string;
  role?: UserRole;
}

@Table({
  tableName: 'users',
  underscored: true,
  indexes: [{ name: 'users_email_unique', unique: true, fields: ['email'] }],
})
export class User extends Model<User, UserCreationAttrs> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'password_hash',
  })
  declare passwordHash: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Default(UserRole.USER)
  @Column({
    type: DataType.ENUM(...USER_ROLE_VALUES),
    allowNull: false,
  })
  declare role: UserRole;

  @CreatedAt declare createdAt: Date;
  @UpdatedAt declare updatedAt: Date;

  @HasMany(() => Application, { foreignKey: 'userId', as: 'applications' })
  declare applications?: Application[];

  /** Strip sensitive fields when serializing. */
  override toJSON(): Omit<ReturnType<Model['toJSON']>, 'passwordHash'> {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values['passwordHash'];
    delete values['password_hash'];
    return values;
  }
}
