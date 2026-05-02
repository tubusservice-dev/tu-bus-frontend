import { Branch } from './branch.model';
import { Product } from './product.model';

/**
 * BranchProduct — pivot between Branch and Product.
 * Tracks per-branch stock for each product.
 * branch/product can be populated objects or string IDs depending on the endpoint.
 */
export interface BranchProduct {
  id: string;
  branch: Branch | string;
  product: Product | string;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchProductBatchRequest {
  productId: string;
  assignments: Array<{
    branchId: string;
    stock: number;
    /** Optional initial active flag. Defaults to `true` server-side. */
    isActive?: boolean;
  }>;
}

export interface UpdateBranchProductRequest {
  stock?: number;
  isActive?: boolean;
}

/**
 * Body of `PUT /api/branch-products/admin/batch-stock`.
 * Each entry is an absolute new stock value (not a delta).
 */
export interface BatchUpdateStockRequest {
  updates: Array<{
    id: string;
    stock: number;
  }>;
}

export interface BranchProductResponse {
  success: boolean;
  data: BranchProduct;
  message?: string;
}

export interface BranchProductListResponse {
  success: boolean;
  data: BranchProduct[];
}
