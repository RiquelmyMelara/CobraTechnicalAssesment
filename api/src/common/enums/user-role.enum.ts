export const UserRole = {
  USER: 'user',
  STAFF: 'staff',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLE_VALUES = Object.values(UserRole);
