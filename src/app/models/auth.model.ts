/**
 * Modelos de Autenticación
 */

import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Sign-up payload. Personal data (document, phone, birth date, company
 * name) is collected later via the "complete profile" modal that opens
 * on /perfil after verification — same UX for both Google and email
 * sign-ups.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token?: string;
    /** Set to true when EMAIL_VERIFICATION_REQUIRED is on AND the user just registered. */
    requiresVerification?: boolean;
    /**
     * Set to true when the local registration overlapped an existing
     * Google-only account and the link-account flow was triggered. The
     * frontend MUST NOT auto-login in this case.
     */
    requiresLinkVerification?: boolean;
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
    /**
     * true → email is registered as a Google-only account. The frontend
     * skips the email entirely and reroutes the user to the link-account
     * flow with `prefillEmail`.
     */
    requiresAccountLink?: boolean;
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
  /**
   * Present when the backend auto-logs in after verification (the user just
   * proved mailbox ownership, so dropping them on the landing page would be
   * friction). The frontend persists the token and redirects to /perfil.
   */
  data?: {
    user: User;
    token: string;
  };
}

export interface ResendVerificationResponse {
  success: boolean;
  message?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Account linking (Google-only → email/password)
// ──────────────────────────────────────────────────────────────────────────

export type LinkAccountRequest = RegisterRequest;

export interface LinkAccountResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    requiresLinkVerification: boolean;
  };
}

export interface VerifyAccountLinkResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Email-uniqueness check (async validator)
// ──────────────────────────────────────────────────────────────────────────

export interface CheckEmailResponse {
  success: boolean;
  data: {
    exists: boolean;
    /**
     * True when the email belongs to a Google-only account (no password set).
     * The auth modal uses this to skip the "email already taken" error and
     * route the submit to /auth/link-account instead of /auth/register.
     */
    isOAuthOnly?: boolean;
  };
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

export type OAuthProvider = 'google';
