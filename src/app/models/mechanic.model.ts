export interface Mechanic {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  zone?: string | { id: string; name: string };
  municipality?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMechanicRequest {
  name: string;
  whatsapp: string;
  email?: string;
  zone?: string;
  municipality?: string;
}

export interface UpdateMechanicRequest {
  name?: string;
  whatsapp?: string;
  email?: string;
  zone?: string;
  municipality?: string;
}

export interface MechanicResponse {
  success: boolean;
  message?: string;
  data: Mechanic;
}

export interface MechanicListResponse {
  success: boolean;
  data: Mechanic[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}
