import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateAssignmentRequest,
  MechanicAssignmentResponse,
  MechanicAssignmentListResponse,
  AvailableMechanicsResponse,
  MechanicCalendarResponse,
  AvailableSlotsResponse,
} from '../../models/mechanic-assignment.model';

@Injectable({
  providedIn: 'root',
})
export class MechanicAssignmentService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/admin/mechanic-assignments`;
  private readonly publicUrl = `${environment.apiUrl}/mechanic-progress`;

  // Admin endpoints
  createAssignment(data: CreateAssignmentRequest): Observable<MechanicAssignmentResponse> {
    return this.http.post<MechanicAssignmentResponse>(this.adminUrl, data);
  }

  getAllByMechanic(mechanicId: string): Observable<MechanicAssignmentListResponse> {
    return this.http.get<MechanicAssignmentListResponse>(
      `${this.adminUrl}/mechanic/${mechanicId}/all`
    );
  }

  getByMechanic(
    mechanicId: string,
    startDate: string,
    endDate: string
  ): Observable<MechanicAssignmentListResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<MechanicAssignmentListResponse>(
      `${this.adminUrl}/mechanic/${mechanicId}`,
      { params }
    );
  }

  getMechanicCalendar(
    mechanicId: string,
    month: number,
    year: number
  ): Observable<MechanicCalendarResponse> {
    const params = new HttpParams()
      .set('month', month)
      .set('year', year);
    return this.http.get<MechanicCalendarResponse>(
      `${this.adminUrl}/mechanic/${mechanicId}/calendar`,
      { params }
    );
  }

  getByOrder(orderId: string): Observable<MechanicAssignmentListResponse> {
    return this.http.get<MechanicAssignmentListResponse>(
      `${this.adminUrl}/order/${orderId}`
    );
  }

  getAvailableMechanics(
    date: string,
    startTime: string,
    endTime?: string,
    branchId?: string,
    orderId?: string
  ): Observable<AvailableMechanicsResponse> {
    let params = new HttpParams()
      .set('date', date)
      .set('startTime', startTime);
    if (endTime) params = params.set('endTime', endTime);
    if (branchId) params = params.set('branchId', branchId);
    if (orderId) params = params.set('orderId', orderId);
    return this.http.get<AvailableMechanicsResponse>(
      `${this.adminUrl}/available-mechanics`,
      { params }
    );
  }

  getAvailableSlots(
    mechanicId: string,
    date: string,
    orderId?: string,
    step?: number
  ): Observable<AvailableSlotsResponse> {
    let params = new HttpParams()
      .set('mechanicId', mechanicId)
      .set('date', date);
    if (orderId) params = params.set('orderId', orderId);
    if (step !== undefined) params = params.set('step', step);
    return this.http.get<AvailableSlotsResponse>(
      `${this.adminUrl}/available-slots`,
      { params }
    );
  }

  cancelAssignment(
    assignmentId: string,
    reason?: string
  ): Observable<MechanicAssignmentResponse> {
    return this.http.patch<MechanicAssignmentResponse>(
      `${this.adminUrl}/${assignmentId}/cancel`,
      { reason }
    );
  }

  // Public endpoints (no auth)
  getProgressByToken(token: string): Observable<MechanicAssignmentResponse> {
    return this.http.get<MechanicAssignmentResponse>(
      `${this.publicUrl}/${token}`
    );
  }

  rejectByMechanic(
    token: string,
    reason: string
  ): Observable<MechanicAssignmentResponse> {
    return this.http.patch<MechanicAssignmentResponse>(
      `${this.publicUrl}/${token}/reject`,
      { reason }
    );
  }

  advanceProgress(
    token: string,
    step: string
  ): Observable<MechanicAssignmentResponse> {
    return this.http.patch<MechanicAssignmentResponse>(
      `${this.publicUrl}/${token}/advance`,
      { step }
    );
  }
}
