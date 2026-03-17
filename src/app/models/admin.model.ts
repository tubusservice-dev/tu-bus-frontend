/**
 * Modelo de Administrador
 */
export interface Admin {
  id: string;
  username: string;
  role: 'admin';
  isActive: boolean;
  createdAt: Date;
}

/**
 * Request para login de admin
 */
export interface AdminLoginRequest {
  username: string;
  password: string;
}

/**
 * Response de autenticación de admin
 */
export interface AdminAuthResponse {
  success: boolean;
  message: string;
  data: {
    user: Admin;
    token: string;
  };
}

/**
 * Request para crear admin
 */
export interface CreateAdminRequest {
  username: string;
  password: string;
}

/**
 * Request para actualizar admin
 */
export interface UpdateAdminRequest {
  username?: string;
  password?: string;
  isActive?: boolean;
}

/**
 * Response de perfil de admin
 */
export interface AdminProfileResponse {
  success: boolean;
  data: Admin;
}

/**
 * Response de lista de admins
 */
export interface AdminListResponse {
  success: boolean;
  data: Admin[];
  pagination?: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

/**
 * Response de operación exitosa
 */
export interface AdminOperationResponse {
  success: boolean;
  message: string;
  data?: Admin;
}