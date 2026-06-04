import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocumentType, User } from '../../models';

export interface UpdateProfileRequest {
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
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetPasswordRequest {
  newPassword: string;
}

export interface DeleteAccountRequest {
  /** Required for local accounts (those with a password). */
  currentPassword?: string;
  /** Required for OAuth-only accounts: the literal confirmation phrase. */
  confirmationPhrase?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message?: string;
}

export interface UserResponse {
  success: boolean;
  message?: string;
  data: User;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    /** Nuevo JWT — el actual queda invalidado por `passwordChangedAt`. */
    token: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Obtiene el perfil del usuario actual
   */
  getProfile(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.apiUrl}/profile`);
  }

  /**
   * Actualiza el perfil del usuario
   */
  updateProfile(data: UpdateProfileRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/profile`, data);
  }

  /**
   * Cambia la contraseña del usuario. El backend stamp `passwordChangedAt`
   * (invalida el JWT actual) y emite uno nuevo en la respuesta — el caller
   * debe persistirlo via `AuthService.applyNewSession()` para mantener al
   * usuario logueado sin disrupción.
   */
  changePassword(data: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    return this.http.put<ChangePasswordResponse>(`${this.apiUrl}/change-password`, data);
  }

  /**
   * Configura una contraseña local para una cuenta vinculada con OAuth (Google).
   * Tras el éxito, la cuenta podrá iniciar sesión por Google o por email + contraseña.
   */
  setPassword(data: SetPasswordRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/set-password`, data);
  }

  /**
   * Permanently deletes (anonymizes) the current user's account. The backend
   * scrubs all PII and invalidates the session, so the caller MUST log the
   * user out afterwards. Local accounts verify via `currentPassword`;
   * OAuth-only accounts verify via `confirmationPhrase`.
   */
  deleteAccount(data: DeleteAccountRequest): Observable<DeleteAccountResponse> {
    return this.http.delete<DeleteAccountResponse>(`${this.apiUrl}/account`, { body: data });
  }
}