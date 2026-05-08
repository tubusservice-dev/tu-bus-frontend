export type DevicePlatform = 'web' | 'android' | 'ios';

export interface RegisterDeviceTokenRequest {
  token: string;
  platform?: DevicePlatform;
  userAgent?: string;
}

export interface RegisterDeviceTokenResponse {
  success: boolean;
  data: { id: string };
}
