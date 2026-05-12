import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CartService } from '@core/services/cart.service';
import { LocationService, BranchSummary } from '@core/services/location.service';
import { BranchProductService } from '@core/services/branch-product.service';
import { CheckoutService } from '@features/checkout/services/checkout.service';

/**
 * Loads and caches per-branch stock for every cart product, then exposes
 * `availableBranches` — a sorted list where each branch is flagged with
 * `insufficientStock=true` when it cannot fulfill the whole cart.
 *
 * Registered as a provider on the summary component so its state is reset
 * each time the user lands on the summary screen.
 */
@Injectable()
export class CheckoutBranchStockService {
  private readonly cartService = inject(CartService);
  private readonly locationService = inject(LocationService);
  private readonly branchProductService = inject(BranchProductService);
  private readonly checkoutService = inject(CheckoutService);

  /** Per-branch stock map: branchId → Map<productId, stock>. */
  readonly branchStockMap = signal<Map<string, Map<string, number>>>(new Map());
  readonly isLoadingBranchStock = signal(false);

  /**
   * All branches for the active dispatch type. Replicates the component's
   * `allBranches` getter — the in-store flow filters to branches that
   * actually offer the in-store oil-change service.
   */
  private readonly allBranches = computed<BranchSummary[]>(() => {
    const dt = this.checkoutService.dispatchType();
    if (dt === 'in_store_oil_change') return this.locationService.branchesWithOilChange();
    return this.locationService.branches();
  });

  /**
   * Branches with their `insufficientStock` flag computed against the current
   * cart. Branches that can fulfill the entire cart sort first.
   */
  readonly availableBranches = computed<(BranchSummary & { insufficientStock?: boolean })[]>(() => {
    const branches = this.allBranches();
    const stockMap = this.branchStockMap();
    const cartItems = this.cartService.items();

    // If stock data not loaded yet, show all branches without stock info
    if (stockMap.size === 0) return branches;

    return branches.map(branch => {
      const branchStock = stockMap.get(branch.id);
      if (!branchStock) return { ...branch, insufficientStock: true };

      const hasEnough = cartItems.every(item => {
        const stock = branchStock.get(item.id) ?? 0;
        return stock >= item.quantity;
      });

      return { ...branch, insufficientStock: !hasEnough };
    }).sort((a, b) => {
      // Branches with sufficient stock first
      if (a.insufficientStock && !b.insufficientStock) return 1;
      if (!a.insufficientStock && b.insufficientStock) return -1;
      return 0;
    });
  });

  /**
   * Fetches per-branch stock for every cart item and populates
   * `branchStockMap`. Auto-selects the only valid branch when applicable.
   */
  loadBranchStockForCart(): void {
    const cartItems = this.cartService.items();
    const branchIds = this.locationService.branchIds();
    if (cartItems.length === 0 || branchIds.length === 0) return;

    this.isLoadingBranchStock.set(true);

    const requests = cartItems.map(item =>
      this.branchProductService.getAggregatedStock(item.id, branchIds)
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const map = new Map<string, Map<string, number>>();

        responses.forEach((res, idx) => {
          const productId = cartItems[idx].id;
          for (const entry of res.data.byBranch) {
            if (!map.has(entry.branchId)) {
              map.set(entry.branchId, new Map());
            }
            map.get(entry.branchId)!.set(productId, entry.stock);
          }
        });

        this.branchStockMap.set(map);
        this.isLoadingBranchStock.set(false);

        // Auto-select best branch if only one has sufficient stock or only one branch
        this.autoSelectBestBranch();
      },
      error: () => {
        this.isLoadingBranchStock.set(false);
      },
    });
  }

  /**
   * Auto-select a branch from the valid-stock list based on the active flow:
   *   - Flows with explicit branch UI (`store_pickup`, `in_store_oil_change`):
   *     only auto-select when there's exactly one valid option — otherwise
   *     defer to the user, who sees the list and clicks.
   *   - Flows without branch UI (`oil_change_service`): always pick the first
   *     valid branch. The customer never sees this choice because the technician
   *     travels to them; the order needs a branch attached so contact info
   *     (phone, address) flows to the confirmation screen. The admin can
   *     reassign later if needed.
   *   - If no branches have sufficient stock, do nothing — assigning a branch
   *     without stock would create an inconsistent order.
   */
  private autoSelectBestBranch(): void {
    const branches = this.availableBranches();
    const validBranches = branches.filter(b => !b.insufficientStock);

    if (validBranches.length === 0) return;
    if (this.checkoutService.selectedBranch()) return;

    const dt = this.checkoutService.dispatchType();
    const requiresExplicitChoice = dt === 'store_pickup' || dt === 'in_store_oil_change';
    if (requiresExplicitChoice && validBranches.length !== 1) return;

    this.checkoutService.selectBranch(validBranches[0]);
  }
}
