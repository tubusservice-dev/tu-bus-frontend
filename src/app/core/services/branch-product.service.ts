import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BranchProductListResponse,
  BranchProductResponse,
  CreateBranchProductBatchRequest,
  UpdateBranchProductRequest,
} from '../../models/branch-product.model';

/**
 * Service for BranchProduct pivot operations.
 * Manages product assignments to branches with per-branch stock.
 */
@Injectable({
  providedIn: 'root',
})
export class BranchProductService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/branch-products/admin`;

  /**
   * Get all BranchProducts for a branch (populated with product).
   */
  getByBranch(branchId: string): Observable<BranchProductListResponse> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<BranchProductListResponse>(this.adminUrl, { params });
  }

  /**
   * Get all BranchProducts for a product (populated with branch).
   */
  getByProduct(productId: string): Observable<BranchProductListResponse> {
    const params = new HttpParams().set('productId', productId);
    return this.http.get<BranchProductListResponse>(this.adminUrl, { params });
  }

  /**
   * Create multiple BranchProducts atomically.
   */
  createBatch(data: CreateBranchProductBatchRequest): Observable<BranchProductListResponse> {
    return this.http.post<BranchProductListResponse>(`${this.adminUrl}/batch`, data);
  }

  /**
   * Update stock or status of an existing BranchProduct.
   */
  update(id: string, data: UpdateBranchProductRequest): Observable<BranchProductResponse> {
    return this.http.put<BranchProductResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Increment/decrement stock by quantity.
   */
  updateStock(id: string, quantity: number): Observable<BranchProductResponse> {
    return this.http.patch<BranchProductResponse>(`${this.adminUrl}/${id}/stock`, { quantity });
  }

  /**
   * Delete a single BranchProduct.
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
