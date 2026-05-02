/**
 * Row shape returned by GET /api/admin/products/by-branch.
 * Mirrors the backend AdminProductByBranchRow.
 */
export interface AdminProductByBranchRow {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  images: string[];
  price: number;
  comparePrice?: number;
  productModel?: string;
  isActive: boolean;
  isFeatured: boolean;
  brand: { id: string; name: string } | null;
  line: { id: string; name: string } | null;
  categories: { id: string; name: string; vehicleTypes: string[] }[];
  /**
   * Stock contextualizado al filtro:
   *   branchId='all'  → suma de stocks activos en todas las sucursales
   *   branchId='none' → 0
   *   branchId=<id>   → stock de esa sucursal
   */
  branchStock: number;
  /** Solo presente cuando se filtra por una sucursal específica. */
  branchProductId?: string;
  /** Solo presente cuando se filtra por una sucursal específica. */
  branchName?: string;
}

export interface AdminProductByBranchListResponse {
  success: boolean;
  data: AdminProductByBranchRow[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface AdminProductByBranchQuery {
  branchId?: 'all' | 'none' | string;
  page?: number;
  limit?: number;
  search?: string;
  vehicleType?: string;
  brand?: string;
  category?: string;
  isActive?: boolean;
  sortBy?: 'price' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}
