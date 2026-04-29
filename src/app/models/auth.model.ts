/**
 * Modelos de Autenticación
 */

import { DocumentType, User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
  birthDate?: string;
  companyName?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token?: string;
    /** Set to true when EMAIL_VERIFICATION_REQUIRED is on AND the user just registered. */
    requiresVerification?: boolean;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Forgot / Reset password
// ──────────────────────────────────────────────────────────────────────────

export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  data: {
    /** false → email is not registered (frontend shows "register?" modal). */
    exists: boolean;
  };
}

export interface VerifyResetTokenResponse {
  success: boolean;
  data: {
    valid: boolean;
    reason?: 'expired' | 'used' | 'invalid';
  };
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Email verification
// ──────────────────────────────────────────────────────────────────────────

export interface VerifyEmailResponse {
  success: boolean;
  message?: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Email-uniqueness check (async validator)
// ──────────────────────────────────────────────────────────────────────────

export interface CheckEmailResponse {
  success: boolean;
  data: { exists: boolean };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export type OAuthProvider = 'google' | 'facebook';