export interface ScheduleDay {
  day: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Branch {
  id: string;
  name: string;
  description?: string;
  address: string;
  whatsappPhone: string;
  landlinePhone?: string;
  schedule: ScheduleDay[];
  coordinates?: Coordinates;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  name: string;
  description?: string;
  address: string;
  whatsappPhone: string;
  landlinePhone?: string;
  schedule: ScheduleDay[];
  coordinates?: Coordinates;
  isActive?: boolean;
}

export interface UpdateBranchRequest extends Partial<CreateBranchRequest> {}

export interface BranchResponse {
  success: boolean;
  message?: string;
  data: Branch;
}

export interface BranchListResponse {
  success: boolean;
  data: Branch[];
}
