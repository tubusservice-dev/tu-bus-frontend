/**
 * Modelo de Usuario
 */

export type DocumentType = 'V' | 'E' | 'J' | 'P' | 'G';

export interface User {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  birthDate?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  phone?: string;
  alternativePhone?: string;
  stateCode?: string;
  stateName?: string;
  cityCode?: string;
  cityName?: string;
  municipalityCode?: string;
  municipalityName?: string;
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
  referencePoint?: string;
  zipCode?: string;
  address?: string;
  companyName?: string;
  companyRif?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: Date;
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SELLER = 'seller',
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  fullName: string;
}