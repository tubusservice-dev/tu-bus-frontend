/**
 * Modelo de Usuario
 */

export type DocumentType = 'V' | 'E' | 'J' | 'P' | 'G';

export interface User {
  id: string;
  email?: string;
  /**
   * Only populated for admin sessions (Admin model in the backend).
   * Customer users never carry username — backend dropped that field
   * during the auth-system v2 migration.
   */
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
  /**
   * True when the user has filled all mandatory personal data. OAuth users
   * start at false; local registrations always reach true at creation time.
   */
  profileCompleted: boolean;
  createdAt: Date;
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SELLER = 'seller',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
  DELETED = 'deleted',
}

export interface AdminUser extends User {
  status: UserStatus;
  isActive: boolean;
  blockReason?: string;
  blockedAt?: string | Date;
  blockedBy?: string;
  suspendedUntil?: string | Date;
  updatedAt?: string | Date;
  ordersCount?: number;
  vehiclesCount?: number;
  totalSpent?: number;
  lastOrderAt?: string | Date;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  fullName: string;
}
