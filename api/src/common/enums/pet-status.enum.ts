export const PetStatus = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  ADOPTED: 'adopted',
} as const;

export type PetStatus = (typeof PetStatus)[keyof typeof PetStatus];

export const PET_STATUS_VALUES = Object.values(PetStatus);
