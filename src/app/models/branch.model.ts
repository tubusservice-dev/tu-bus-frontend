export interface ScheduleDay {
  day: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface ServiceMunicipality {
  municipalityCode: string;
  municipalityName: string;
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
  hasOilChangeService: boolean;
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
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  coordinates?: Coordinates;
  serviceMunicipalities: ServiceMunicipality[];
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
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  coordinates?: Coordinates;
  serviceMunicipalities: ServiceMunicipality[];
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

export interface State {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface StateListResponse {
  success: boolean;
  data: State[];
}
