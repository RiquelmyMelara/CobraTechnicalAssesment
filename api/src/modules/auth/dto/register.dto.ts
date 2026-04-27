import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @Length(1, 120)
  @Matches(/^[\p{L}\p{M} '.\-]+$/u, {
    message:
      'name may contain letters, spaces, apostrophes, periods and hyphens',
  })
  name!: string;
}
