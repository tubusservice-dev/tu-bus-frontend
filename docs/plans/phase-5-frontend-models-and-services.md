# Phase 5: Frontend — Models & Services

> **Prerequisites:** Phases 1-4 (backend must be fully operational)
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 2, 5

---

## Objective

Create all TypeScript interfaces and Angular HTTP services needed by the frontend to communicate with the redesigned backend. This phase creates the data layer — no UI components are modified yet.

---

## Angular Patterns Used

```typescript
// Service pattern (inject-based, no constructor)
@Injectable({ providedIn: 'root' })
export class ExampleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/example`;

  getAll(): Observable<ExampleListResponse> {
    return this.http.get<ExampleListResponse>(this.apiUrl);
  }
}

// Model pattern (pure interfaces, no classes)
export interface Example { id: string; name: string; }
export interface ExampleResponse { success: boolean; data: Example; message?: string; }
export interface ExampleListResponse { success: boolean; data: Example[]; }
```

---

## Part A: New Model Files

### Step A.1: Create `frontend/src/app/models/city.model.ts` (NEW)

```typescript
export interface Municipality {
  name: string;
  slug: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  municipalities: Municipality[];
  isActive: boolean;
}

export interface CityListResponse {
  success: boolean;
  data: City[];
}

export interface CityResponse {
  success: boolean;
  data: City;
}
```

### Step A.2: Create `frontend/src/app/models/zone.model.ts` (NEW)

```typescript
import { City } from './city.model';

export interface Zone {
  id: string;
  name: string;
  city: City | string;          // populated or just ID
  municipalities: string[];     // slugs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateZoneRequest {
  name: string;
  city: string;                 // City ObjectId
  municipalities: string[];     // slugs
  isActive?: boolean;
}

export interface UpdateZoneRequest {
  name?: string;
  city?: string;
  municipalities?: string[];
  isActive?: boolean;
}

export interface ZoneResponse {
  success: boolean;
  data: Zone;
  message?: string;
}

export interface ZoneListResponse {
  success: boolean;
  data: Zone[];
}

export interface CheckNameResponse {
  success: boolean;
  data: { exists: boolean };
}
```

### Step A.3: Create `frontend/src/app/models/branch-zone.model.ts` (NEW)

```typescript
import { Zone } from './zone.model';

export interface DeliveryConfigItem {
  municipality: string;          // slug
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
  hasOilChangeService: boolean;
}

export interface BranchZone {
  id: string;
  branch: any;                   // populated Branch or string ID
  zone: Zone | string;           // populated Zone (with city) or string ID
  deliveryConfig: DeliveryConfigItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchZoneBatchRequest {
  branchId: string;
  zones: Array<{
    zoneId: string;
    deliveryConfig?: DeliveryConfigItem[];
  }>;
}

export interface UpdateBranchZoneRequest {
  deliveryConfig?: DeliveryConfigItem[];
  isActive?: boolean;
}

export interface BranchZoneResponse {
  success: boolean;
  data: BranchZone;
  message?: string;
}

export interface BranchZoneListResponse {
  success: boolean;
  data: BranchZone[];
}
```

### Step A.4: Create `frontend/src/app/models/branch-product.model.ts` (NEW)

```typescript
export interface BranchProduct {
  id: string;
  branch: any;                   // populated Branch or string ID
  product: any;                  // populated Product or string ID
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
  }>;
}

export interface UpdateBranchProductRequest {
  stock?: number;
  isActive?: boolean;
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
```

### Step A.5: Modify `frontend/src/app/models/branch.model.ts` (MODIFY)

**DELETE interfaces:**
- `ServiceMunicipality` (entire interface)
- `ServiceZone` (entire interface)

**DELETE from `Branch` interface:**
- `stateCode?: string`
- `stateName?: string`
- `cityCode?: string`
- `cityName?: string`
- `serviceMunicipalities?: ServiceMunicipality[]`
- `serviceZones?: ServiceZone[]`

**DELETE from `CreateBranchRequest` / `UpdateBranchRequest`:**
- All zone-related fields (stateCode, stateName, cityCode, cityName, serviceMunicipalities, serviceZones)

### Step A.6: Modify `frontend/src/app/models/product.model.ts` (MODIFY)

**DELETE from `Product` interface:**
- `branches?: any[]`

**DELETE from `CreateProductRequest`:**
- `branches?: string[]`
- `stock?: number`

**DELETE from `UpdateProductRequest`:**
- `branches?: string[]`
- `stock?: number`

---

## Part B: New Service Files

### Step B.1: Create `frontend/src/app/core/services/city.service.ts` (NEW)

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CityListResponse, CityResponse } from '../../models/city.model';

@Injectable({ providedIn: 'root' })
export class CityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/cities`;

  getAll(): Observable<CityListResponse> {
    return this.http.get<CityListResponse>(this.apiUrl);
  }

  getBySlug(slug: string): Observable<CityResponse> {
    return this.http.get<CityResponse>(`${this.apiUrl}/${slug}`);
  }
}
```

### Step B.2: Rewrite `frontend/src/app/core/services/zone.service.ts` (REWRITE)

**DELETE ENTIRELY:**
- All inline interfaces (City, Municipality, ReferenceCity, etc.) — now in `models/zone.model.ts`
- All signal state management (`_cities`, `_selectedCity`, etc.)
- All localStorage logic
- All state-related methods (`getAllStates`, `getActiveStates`, `getCitiesByState`)
- All reference city methods (`getReferenceCities`, `getReferenceCityByCode`)
- All municipality CRUD methods (`addMunicipality`, `updateMunicipality`, `removeMunicipality`)
- All computed signals and selection methods
- Fallback data

**REPLACE with clean service:**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ZoneListResponse, ZoneResponse, CheckNameResponse,
  CreateZoneRequest, UpdateZoneRequest,
} from '../../models/zone.model';

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/zones`;
  private readonly adminUrl = `${environment.apiUrl}/zones/admin`;

  // Public (active zones only)
  getActive(): Observable<ZoneListResponse> {
    return this.http.get<ZoneListResponse>(this.apiUrl);
  }

  getById(id: string): Observable<ZoneResponse> {
    return this.http.get<ZoneResponse>(`${this.apiUrl}/${id}`);
  }

  // Admin
  getAllAdmin(): Observable<ZoneListResponse> {
    return this.http.get<ZoneListResponse>(this.adminUrl);
  }

  checkName(name: string): Observable<CheckNameResponse> {
    const params = new HttpParams().set('name', name);
    return this.http.get<CheckNameResponse>(`${this.adminUrl}/check-name`, { params });
  }

  create(data: CreateZoneRequest): Observable<ZoneResponse> {
    return this.http.post<ZoneResponse>(this.adminUrl, data);
  }

  update(id: string, data: UpdateZoneRequest): Observable<ZoneResponse> {
    return this.http.put<ZoneResponse>(`${this.adminUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
```

### Step B.3: Create `frontend/src/app/core/services/branch-zone.service.ts` (NEW)

```typescript
@Injectable({ providedIn: 'root' })
export class BranchZoneService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/branch-zones/admin`;

  getByBranch(branchId: string): Observable<BranchZoneListResponse> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<BranchZoneListResponse>(this.adminUrl, { params });
  }

  getByZone(zoneId: string): Observable<BranchZoneListResponse> {
    const params = new HttpParams().set('zoneId', zoneId);
    return this.http.get<BranchZoneListResponse>(this.adminUrl, { params });
  }

  createBatch(data: CreateBranchZoneBatchRequest): Observable<BranchZoneListResponse> {
    return this.http.post<BranchZoneListResponse>(`${this.adminUrl}/batch`, data);
  }

  update(id: string, data: UpdateBranchZoneRequest): Observable<BranchZoneResponse> {
    return this.http.put<BranchZoneResponse>(`${this.adminUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
```

### Step B.4: Create `frontend/src/app/core/services/branch-product.service.ts` (NEW)

```typescript
@Injectable({ providedIn: 'root' })
export class BranchProductService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/branch-products/admin`;

  getByBranch(branchId: string): Observable<BranchProductListResponse> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<BranchProductListResponse>(this.adminUrl, { params });
  }

  getByProduct(productId: string): Observable<BranchProductListResponse> {
    const params = new HttpParams().set('productId', productId);
    return this.http.get<BranchProductListResponse>(this.adminUrl, { params });
  }

  createBatch(data: CreateBranchProductBatchRequest): Observable<BranchProductListResponse> {
    return this.http.post<BranchProductListResponse>(`${this.adminUrl}/batch`, data);
  }

  update(id: string, data: UpdateBranchProductRequest): Observable<BranchProductResponse> {
    return this.http.put<BranchProductResponse>(`${this.adminUrl}/${id}`, data);
  }

  updateStock(id: string, quantity: number): Observable<BranchProductResponse> {
    return this.http.patch<BranchProductResponse>(`${this.adminUrl}/${id}/stock`, { quantity });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
```

### Step B.5: Modify `frontend/src/app/core/services/product.service.ts` (MODIFY)

**DELETE from `ProductQueryParams` interface:**
- `branchId?: string`
- `branchIds?: string | string[]`

**Adjust** any references to `stock` or `branches` in request/response handling (if ProductQueryParams was used to build params, the branch-related entries no longer need to be included).

---

## Verification

1. `ng build` — zero compilation errors
2. All new services are injectable (providedIn: root)
3. All interfaces match backend response shapes
4. No orphaned imports (removed interfaces no longer referenced)
5. Existing components may show compile errors — those are expected and will be fixed in Phase 6

---

## Summary

| Action | Count | Files |
|--------|-------|-------|
| NEW models | 4 | city.model.ts, zone.model.ts, branch-zone.model.ts, branch-product.model.ts |
| NEW services | 3 | city.service.ts, branch-zone.service.ts, branch-product.service.ts |
| REWRITE | 1 | zone.service.ts |
| MODIFY models | 2 | branch.model.ts, product.model.ts |
| MODIFY services | 1 | product.service.ts |
| **Total** | **11** | |
