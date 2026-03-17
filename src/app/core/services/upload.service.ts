import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: UploadResult;
}

export interface MultiUploadResponse {
  success: boolean;
  message: string;
  data: UploadResult[];
}

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private readonly apiUrl = `${environment.apiUrl}/upload`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Sube un avatar de usuario
   */
  uploadAvatar(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<UploadResponse>(`${this.apiUrl}/avatar`, formData);
  }

  /**
   * Sube una imagen general
   */
  uploadImage(file: File, folder?: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);
    if (folder) {
      formData.append('folder', folder);
    }
    return this.http.post<UploadResponse>(`${this.apiUrl}/image`, formData);
  }

  /**
   * Sube múltiples imágenes de producto
   */
  uploadProductImages(files: File[]): Observable<MultiUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    return this.http.post<MultiUploadResponse>(`${this.apiUrl}/products`, formData);
  }

  /**
   * Elimina una imagen
   */
  deleteImage(publicId: string): Observable<{ success: boolean; message: string }> {
    const encodedId = encodeURIComponent(publicId);
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${encodedId}`);
  }
}