import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BranchListResponse, BranchResponse, CreateBranchRequest, UpdateBranchRequest } from '../../models/branch.model';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/branches`;
  private readonly adminUrl = `${this.baseUrl}/admin`;

  // Admin — all branches including inactive
  getAll(): Observable<BranchListResponse> {
    return this.http.get<BranchListResponse>(this.adminUrl);
  }

  // Public — only active branches
  getActive(): Observable<BranchListResponse> {
    return this.http.get<BranchListResponse>(`${this.baseUrl}/active`);
  }

  getById(id: string): Observable<BranchResponse> {
    return this.http.get<BranchResponse>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateBranchRequest): Observable<BranchResponse> {
    return this.http.post<BranchResponse>(this.adminUrl, data);
  }

  update(id: string, data: UpdateBranchRequest): Observable<BranchResponse> {
    return this.http.put<BranchResponse>(`${this.adminUrl}/${id}`, data);
  }

  toggleStatus(id: string): Observable<BranchResponse> {
    return this.http.patch<BranchResponse>(`${this.adminUrl}/${id}/status`, {});
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }
}
