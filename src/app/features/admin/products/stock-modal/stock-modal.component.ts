import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchProductService } from '../../../../core/services/branch-product.service';
import { ToastService } from '../../../../shared/services/toast.service';

const MIN_STOCK = 1;
const MAX_STOCK = 9999;

type Step = 'view' | 'input' | 'confirm';

@Component({
  selector: 'app-stock-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-modal.component.html',
  styleUrl: './stock-modal.component.scss',
})
export class StockModalComponent implements OnInit {
  private readonly branchProductService = inject(BranchProductService);
  private readonly toastService = inject(ToastService);

  /** Product info shown in the header. */
  @Input({ required: true }) productName!: string;
  /** Initial branch context label. Empty when filter is "Todas las sucursales". */
  @Input() branchName: string | null = null;
  /** Stock to display in step 1. */
  @Input({ required: true }) currentStock = 0;
  /**
   * BranchProduct id used to PATCH stock. When null, the modal is opened in
   * read-only mode (filter "Todas las sucursales") — no add stock action.
   */
  @Input() branchProductId: string | null = null;

  /** Emitted when the user closes the modal without changes. */
  @Output() closed = new EventEmitter<void>();
  /** Emitted on successful stock update. Carries the new stock value. */
  @Output() stockUpdated = new EventEmitter<number>();

  protected readonly step = signal<Step>('view');
  protected readonly quantityInput = signal<string>('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canEdit = computed(() => !!this.branchProductId);

  protected readonly parsedQuantity = computed(() => {
    const raw = this.quantityInput().trim();
    if (raw === '') return null;
    if (!/^\d+$/.test(raw)) return null;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) return null;
    return num;
  });

  protected readonly isQuantityValid = computed(() => {
    const q = this.parsedQuantity();
    return q !== null && q >= MIN_STOCK && q <= MAX_STOCK;
  });

  protected readonly newStockPreview = computed(() => {
    const q = this.parsedQuantity() ?? 0;
    return this.currentStock + q;
  });

  readonly minStock = MIN_STOCK;
  readonly maxStock = MAX_STOCK;

  ngOnInit(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.isSubmitting()) {
      this.close();
    }
  };

  protected onOverlayClick(): void {
    if (this.isSubmitting()) return;
    this.close();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected goToInput(): void {
    if (!this.canEdit()) return;
    this.errorMessage.set(null);
    this.step.set('input');
  }

  /**
   * Block non-digit input at the source (typing). Allows clipboard paste to
   * fall through so the (input) sanitizer can still strip whatever leaks.
   */
  protected onBeforeInput(event: Event): void {
    const ev = event as InputEvent;
    if (ev.data == null) return; // deletion / IME composition / paste
    if (!/^\d+$/.test(ev.data)) {
      ev.preventDefault();
    }
  }

  /**
   * Sanitize against non-digits (covers paste, drag-drop, autofill) and
   * enforce 4-char cap. Mutates the DOM input synchronously so the visible
   * value never drifts from the signal.
   */
  protected onQuantityInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const sanitized = target.value.replace(/\D+/g, '').slice(0, 4);
    if (target.value !== sanitized) {
      target.value = sanitized;
    }
    this.quantityInput.set(sanitized);
  }

  protected goToConfirm(): void {
    if (!this.isQuantityValid()) return;
    this.errorMessage.set(null);
    this.step.set('confirm');
  }

  protected backToInput(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set(null);
    this.step.set('input');
  }

  protected confirmAdd(): void {
    if (this.isSubmitting()) return;
    const bpId = this.branchProductId;
    const quantity = this.parsedQuantity();
    if (!bpId || quantity === null || !this.isQuantityValid()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.branchProductService.updateStock(bpId, quantity).subscribe({
      next: (response) => {
        const newStock = response.data?.stock ?? this.currentStock + quantity;
        const branchLabel = this.branchName || 'la sucursal';
        this.toastService.success(
          `Stock actualizado: +${quantity} unidades en ${branchLabel}`
        );
        this.isSubmitting.set(false);
        this.stockUpdated.emit(newStock);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message || 'No se pudo actualizar el stock. Intenta nuevamente.'
        );
      },
    });
  }
}
