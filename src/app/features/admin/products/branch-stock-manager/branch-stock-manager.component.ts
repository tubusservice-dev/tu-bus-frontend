import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BranchProductService } from '../../../../core/services/branch-product.service';
import { BranchProduct } from '../../../../models/branch-product.model';
import { Branch } from '../../../../models/branch.model';
import { ToastService } from '../../../../shared/services/toast.service';

interface NewBranchAssignment {
  branch: Branch;
  stock: number;
  isActive: boolean;
}

const MAX_STOCK = 99999;

/**
 * Reusable manager for the per-branch stock + active flag of a single product.
 *
 * Two consumption modes via `ownSaveButton`:
 *
 * - **`ownSaveButton = false`** (embedded): the host (e.g. product-form) is
 *   responsible for triggering the save by calling `save(productId)` —
 *   useful when the parent form needs to create/update the product first
 *   and then persist branch changes within the same orchestration.
 *
 * - **`ownSaveButton = true`** (standalone): the component renders its own
 *   "Guardar cambios" button and runs the batch save itself. It assumes
 *   `productId` is already a valid backend id (i.e. edit-only flows like
 *   the admin product detail modal).
 *
 * `dirtyChange` lets parents reflect the unsaved-changes state in their UI
 * (e.g. show a discard-confirmation when the user tries to close).
 */
@Component({
  selector: 'app-branch-stock-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-stock-manager.component.html',
  styleUrl: './branch-stock-manager.component.scss',
})
export class BranchStockManagerComponent implements OnChanges {
  private readonly branchProductService = inject(BranchProductService);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  /**
   * Product id whose branch assignments are being managed. May be `null`
   * during the create flow of a product-form — in that case the component
   * accumulates `newBranchProducts` locally; the host calls `save(id)`
   * once it has the freshly-created backend id.
   */
  @Input() productId: string | null = null;

  /** All active branches available for assignment. Caller-owned. */
  @Input() availableBranches: Branch[] = [];

  /**
   * When true, renders a "Guardar cambios" button and handles save itself.
   * When false, the host triggers the save by invoking `save()`.
   */
  @Input() ownSaveButton = false;

  /** Emitted whenever the dirty state flips (true = unsaved changes). */
  @Output() dirtyChange = new EventEmitter<boolean>();

  /** Emitted after a successful save (standalone mode only). */
  @Output() saved = new EventEmitter<void>();

  // ───── Local state ─────────────────────────────────────────────
  protected readonly existingBranchProducts = signal<BranchProduct[]>([]);
  protected readonly newBranchProducts = signal<NewBranchAssignment[]>([]);
  protected readonly deletedBranchProductIds = signal<string[]>([]);

  protected readonly branchSearchTerm = signal('');
  protected readonly showBranchDropdown = signal(false);

  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);

  readonly minStock = 0;
  readonly maxStock = MAX_STOCK;

  // ───── Derived ─────────────────────────────────────────────────
  protected readonly filteredBranches = computed(() => {
    const search = this.branchSearchTerm().toLowerCase().trim();
    const assignedIds = new Set([
      ...this.existingBranchProducts()
        .filter((bp) => !this.deletedBranchProductIds().includes(bp.id))
        .map((bp) => (typeof bp.branch === 'string' ? bp.branch : (bp.branch as Branch).id)),
      ...this.newBranchProducts().map((nbp) => nbp.branch.id),
    ]);
    let filtered = this.availableBranches.filter(
      (b) => b.isActive && !assignedIds.has(b.id)
    );
    if (search) {
      filtered = filtered.filter((b) => b.name.toLowerCase().includes(search));
    }
    return filtered;
  });

  protected readonly totalStock = computed(() => {
    const existingStock = this.existingBranchProducts()
      .filter((bp) => !this.deletedBranchProductIds().includes(bp.id))
      .reduce((sum, bp) => sum + bp.stock, 0);
    const newStock = this.newBranchProducts().reduce((sum, nbp) => sum + nbp.stock, 0);
    return existingStock + newStock;
  });

  protected readonly outOfStockCount = computed(() => {
    const existingOos = this.existingBranchProducts().filter(
      (bp) => !this.deletedBranchProductIds().includes(bp.id) && bp.stock === 0
    ).length;
    const newOos = this.newBranchProducts().filter((nbp) => nbp.stock === 0).length;
    return existingOos + newOos;
  });

  protected readonly activeBranchCount = computed(() => {
    return (
      this.existingBranchProducts().filter(
        (bp) => !this.deletedBranchProductIds().includes(bp.id)
      ).length + this.newBranchProducts().length
    );
  });

  /**
   * True when there is any unsaved mutation against the loaded baseline:
   * a new assignment, a deletion, a stock change, or an isActive toggle.
   */
  protected readonly isDirty = computed(() => {
    if (this.deletedBranchProductIds().length > 0) return true;
    if (this.newBranchProducts().length > 0) return true;
    return this.existingBranchProducts().some((bp) => {
      const baseline = this.baselineMap.get(bp.id);
      if (!baseline) return false;
      return baseline.stock !== bp.stock || baseline.isActive !== bp.isActive;
    });
  });

  /** Snapshot of the data as it came from the backend, to detect mutations. */
  private baselineMap = new Map<string, { stock: number; isActive: boolean }>();

  constructor() {
    // Notify host when dirty changes
    effect(() => {
      this.dirtyChange.emit(this.isDirty());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && this.productId) {
      this.loadFor(this.productId);
    } else if (changes['productId'] && !this.productId) {
      this.resetState();
    }
  }

  // ───── Public API ───────────────────────────────────────────────

  /**
   * Persist all pending changes against the given product id.
   *
   * Order of operations:
   *   1. Delete all flagged BranchProducts.
   *   2. Update existing (stock + isActive).
   *   3. Create new assignments via batch.
   *
   * Steps run sequentially so a partial failure leaves predictable state.
   * Resolves once all three buckets complete.
   */
  save(productId?: string): Observable<void> {
    const id = productId ?? this.productId;
    if (!id) {
      return throwError(() => new Error('productId is required to save'));
    }
    if (!this.isDirty()) {
      return of(void 0);
    }

    this.isSaving.set(true);

    const deletions$ = this.runDeletions();
    const updates$ = this.runUpdates();
    const creations$ = this.runCreations(id);

    return deletions$.pipe(
      switchMap(() => updates$),
      switchMap(() => creations$),
      map(() => void 0),
      switchMap(() => {
        this.isSaving.set(false);
        // Reload to refresh local state with backend-truth (especially the
        // ids of newly-created BranchProducts).
        return this.reloadFromBackend(id);
      }),
      catchError((err) => {
        this.isSaving.set(false);
        return throwError(() => err);
      })
    );
  }

  /** Triggered by the internal "Guardar cambios" button (standalone mode). */
  protected onClickSave(): void {
    if (!this.productId) return;
    this.save(this.productId).subscribe({
      next: () => {
        this.toastService.success('Sucursales y stock actualizados');
        this.saved.emit();
      },
      error: (err) => {
        this.toastService.error(
          err?.error?.message || 'Error al guardar sucursales'
        );
      },
    });
  }

  // ───── Loading ─────────────────────────────────────────────────

  private loadFor(productId: string): void {
    this.resetState();
    this.isLoading.set(true);
    this.branchProductService.getByProduct(productId).subscribe({
      next: (response) => {
        const normalized = this.normalize(response.data);
        this.existingBranchProducts.set(normalized);
        this.rebuildBaseline(normalized);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private reloadFromBackend(productId: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      this.branchProductService.getByProduct(productId).subscribe({
        next: (response) => {
          const normalized = this.normalize(response.data);
          this.existingBranchProducts.set(normalized);
          this.newBranchProducts.set([]);
          this.deletedBranchProductIds.set([]);
          this.rebuildBaseline(normalized);
          subscriber.next();
          subscriber.complete();
        },
        error: (err) => subscriber.error(err),
      });
    });
  }

  /**
   * Normalize Mongoose lean responses where the toJSON transform never ran.
   *
   * `branchProductService.getByProduct()` uses `.lean()` server-side, which
   * BYPASSES the schema's `toJSON: { transform: _id -> id }` — both for the
   * BranchProduct itself AND for its populated `branch`. The frontend
   * expects `id` everywhere, so a single boundary normalization keeps the
   * downstream code (`filteredBranches`, dirty tracking, save mutations)
   * working consistently.
   */
  private normalize(raw: any[]): BranchProduct[] {
    return raw.map((bp) => {
      const branchVal =
        typeof bp.branch === 'string'
          ? bp.branch
          : { ...bp.branch, id: bp.branch?.id ?? bp.branch?._id };
      return {
        ...bp,
        id: bp.id ?? bp._id,
        branch: branchVal,
      } as BranchProduct;
    });
  }

  private rebuildBaseline(bps: BranchProduct[]): void {
    this.baselineMap = new Map(
      bps.map((bp) => [bp.id, { stock: bp.stock, isActive: bp.isActive }])
    );
  }

  private resetState(): void {
    this.existingBranchProducts.set([]);
    this.newBranchProducts.set([]);
    this.deletedBranchProductIds.set([]);
    this.branchSearchTerm.set('');
    this.showBranchDropdown.set(false);
    this.baselineMap = new Map();
  }

  // ───── Save buckets ───────────────────────────────────────────

  private runDeletions(): Observable<unknown> {
    const ids = this.deletedBranchProductIds();
    if (ids.length === 0) return of(null);
    return forkJoin(ids.map((id) => this.branchProductService.delete(id)));
  }

  private runUpdates(): Observable<unknown> {
    const updates = this.existingBranchProducts()
      .filter((bp) => !this.deletedBranchProductIds().includes(bp.id))
      .filter((bp) => {
        const baseline = this.baselineMap.get(bp.id);
        if (!baseline) return false;
        return baseline.stock !== bp.stock || baseline.isActive !== bp.isActive;
      })
      .map((bp) =>
        this.branchProductService.update(bp.id, {
          stock: bp.stock,
          isActive: bp.isActive,
        })
      );
    if (updates.length === 0) return of(null);
    return forkJoin(updates);
  }

  private runCreations(productId: string): Observable<unknown> {
    const list = this.newBranchProducts();
    if (list.length === 0) return of(null);
    return this.branchProductService.createBatch({
      productId,
      assignments: list.map((nbp) => ({
        branchId: nbp.branch.id,
        stock: nbp.stock,
        isActive: nbp.isActive,
      })),
    });
  }

  // ───── Branch search / add ────────────────────────────────────

  protected onBranchSearch(event: Event): void {
    this.branchSearchTerm.set((event.target as HTMLInputElement).value);
    this.showBranchDropdown.set(true);
  }

  protected openBranchDropdown(): void {
    this.showBranchDropdown.set(true);
  }

  protected closeBranchDropdown(): void {
    setTimeout(() => this.showBranchDropdown.set(false), 200);
  }

  protected addBranch(branch: Branch): void {
    this.newBranchProducts.update((list) => [
      ...list,
      { branch, stock: 0, isActive: true },
    ]);
    this.branchSearchTerm.set('');
    // Keep dropdown open for consecutive picks
  }

  // ───── Mutations ──────────────────────────────────────────────

  protected removeExistingBranchProduct(bpId: string): void {
    this.deletedBranchProductIds.update((ids) => [...ids, bpId]);
  }

  protected removeNewBranchProduct(index: number): void {
    this.newBranchProducts.update((list) => list.filter((_, i) => i !== index));
  }

  protected toggleExistingActive(bpId: string, value: boolean): void {
    this.existingBranchProducts.update((list) =>
      list.map((bp) => (bp.id === bpId ? { ...bp, isActive: value } : bp))
    );
  }

  protected toggleNewActive(index: number, value: boolean): void {
    this.newBranchProducts.update((list) =>
      list.map((item, i) => (i === index ? { ...item, isActive: value } : item))
    );
  }

  protected updateExistingStock(bpId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const raw = parseInt(target.value) || 0;
    const clamped = Math.max(0, Math.min(MAX_STOCK, raw));
    if (raw !== clamped && target.value !== '') {
      target.value = String(clamped);
    }
    this.existingBranchProducts.update((list) =>
      list.map((bp) => (bp.id === bpId ? { ...bp, stock: clamped } : bp))
    );
  }

  protected updateNewStock(index: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const raw = parseInt(target.value) || 0;
    const clamped = Math.max(0, Math.min(MAX_STOCK, raw));
    if (raw !== clamped && target.value !== '') {
      target.value = String(clamped);
    }
    this.newBranchProducts.update((list) =>
      list.map((item, i) => (i === index ? { ...item, stock: clamped } : item))
    );
  }

  protected getBranchName(bp: BranchProduct): string {
    if (typeof bp.branch === 'string') return bp.branch;
    return (bp.branch as Branch)?.name || '';
  }

  // ───── Click-outside for dropdown ─────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const branchSelector = this.elementRef.nativeElement.querySelector('.branch-selector');
    if (branchSelector && !branchSelector.contains(target)) {
      this.showBranchDropdown.set(false);
    }
  }
}
