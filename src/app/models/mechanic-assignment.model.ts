import { Mechanic } from './mechanic.model';

export type AssignmentStatus = 'scheduled' | 'en_camino' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'paused';

export type ProgressStepName = 'asignado' | 'en_camino' | 'en_proceso' | 'completado';

export interface ProgressStep {
  step: ProgressStepName;
  label: string;
  completedAt?: string;
  completedBy?: 'mechanic' | 'admin';
}

export interface MechanicAssignment {
  id: string;
  mechanic: string | { id: string; name: string; whatsapp: string; email?: string };
  order: string | {
    id: string;
    orderNumber: string;
    dispatchType: string;
    dispatchDetails?: any;
    total?: number;
    user?: { id: string; firstName: string; lastName: string; phone?: string };
    vehicles?: any[];
    createdAt?: string;
  };
  scheduledDate: string;
  startTime: string;
  endTime: string;
  status: AssignmentStatus;
  progressSteps: ProgressStep[];
  accessToken: string;
  tokenExpiresAt: string;
  createdBy: string | { id: string; firstName: string; lastName: string };
  cancelledReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentRequest {
  mechanicId: string;
  orderId: string;
  scheduledDate: string;
  startTime: string;
}

export interface AvailableMechanic {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  branches?: any[];
  serviceDurationMinutes: number;
  schedule: any[];
}

export interface MechanicCalendarData {
  assignments: MechanicAssignment[];
  mechanic: Mechanic;
}

export interface MechanicAssignmentResponse {
  success: boolean;
  message?: string;
  data: MechanicAssignment;
}

export interface MechanicAssignmentListResponse {
  success: boolean;
  data: MechanicAssignment[];
}

export interface AvailableMechanicsResponse {
  success: boolean;
  data: AvailableMechanic[];
}

export interface MechanicCalendarResponse {
  success: boolean;
  data: MechanicCalendarData;
}
