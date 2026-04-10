export interface ScheduleDay {
  day: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface DateBlock {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  isAllDay: boolean;
}

export interface Mechanic {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  branches: Array<string | { id: string; name: string; address?: string }>;
  serviceDurationMinutes: number;
  schedule: ScheduleDay[];
  dateBlocks: DateBlock[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMechanicRequest {
  name: string;
  whatsapp: string;
  email?: string;
  branches?: string[];
  serviceDurationMinutes?: number;
  schedule?: ScheduleDay[];
}

export interface UpdateMechanicRequest {
  name?: string;
  whatsapp?: string;
  email?: string;
  branches?: string[];
  serviceDurationMinutes?: number;
  schedule?: ScheduleDay[];
  dateBlocks?: DateBlock[];
}

export interface AddDateBlockRequest {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  isAllDay?: boolean;
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
