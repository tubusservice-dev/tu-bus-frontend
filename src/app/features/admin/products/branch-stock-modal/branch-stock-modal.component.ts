import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../../models/branch.model';
import { BodyScrollLockService } from '../../../../shared/services/body-scroll-lock.service';
import { BranchStockManagerComponent } from '../branch-stock-manager/branch-stock-manager.component';

/**
 * Standalone modal that wraps <app-branch-stock-manager> for use as a
 * quick-edit dialog over the products grid. Renders an overlay + a
 * compact container with:
 *
 * - Header: product name + close button.
 * - Body: the manager in standalone mode (own "Guardar cambios" button).
 *         The "Cancelar" button is projected into the manager's action
 *         row via its content slot.
 * - Discard-changes confirmation: nested, shown when the user attempts
 *   to close while the manager reports unsaved edits.
 *
 * The host owns the "should this modal be visible" decision. When the
 * modal completes a save, it emits `saved` so the host can refresh
 * downstream caches (e.g. the product card stock badges).
 */
@Component({
  selector: 'app-branch-stock-modal',
  standalone: true,
  imports: [CommonModule, BranchStockManagerComponent],
  templateUrl: './branch-stock-modal.component.html',
  styleUrl: './branch-stock-modal.component.scss',
})
export class BranchStockModalComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(BodyScrollLockService);

  @Input({ required: true }) productId!: string;
  @Input({ required: true }) productName!: string;
  @Input() availableBranches: Branch[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  protected readonly isDirty = signal(false);
  protected readonly showDiscardConfirm = signal(false);

  ngOnInit(): void {
    this.scrollLock.lock();
    document.addEventListener('keydown', this.onKeyDown);
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
    document.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.requestClose();
    }
  };

  protected onOverlayClick(): void {
    this.requestClose();
  }

  /**
   * Attempt to close. If the manager has pending edits, surface the
   * discard-confirm dialog instead of closing silently.
   */
  protected requestClose(): void {
    if (this.isDirty()) {
      this.showDiscardConfirm.set(true);
      return;
    }
    this.closed.emit();
  }

  protected confirmDiscard(): void {
    this.showDiscardConfirm.set(false);
    this.closed.emit();
  }

  protected cancelDiscard(): void {
    this.showDiscardConfirm.set(false);
  }

  protected onDirty(dirty: boolean): void {
    this.isDirty.set(dirty);
  }

  /**
   * The manager succeeded. Tell the host (so it can refresh caches) and
   * close the modal — the typical "save and close" UX.
   */
  protected onSaved(): void {
    this.saved.emit();
    this.closed.emit();
  }
}
