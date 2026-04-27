import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService } from '../../../../core/services/review.service';
import {
  DISPATCH_TYPE_SHORT_LABELS,
  Review,
  ReviewAdminSummary,
  ReviewUserPopulated,
} from '../../../../models/review.model';
import { BodyScrollLockService } from '../../../../shared/services/body-scroll-lock.service';

type RatingFilter = 'all' | 1 | 2 | 3 | 4 | 5;
type ResponseFilter = 'all' | 'with' | 'without';

@Component({
  selector: 'app-admin-review-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './review-list.component.html',
  styleUrl: './review-list.component.scss',
})
export class AdminReviewListComponent implements OnInit, OnDestroy {
  private readonly reviewService = inject(ReviewService);
  private readonly scrollLock = inject(BodyScrollLockService);
  private hasScrollLock = false;

  // ==================== LIST STATE ====================
  protected readonly reviews = signal<Review[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly summary = signal<ReviewAdminSummary>({
    average: null,
    count: 0,
    withoutResponse: 0,
  });

  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly pageLimit = 20;

  // ==================== FILTERS ====================
  protected readonly ratingFilter = signal<RatingFilter>('all');
  protected readonly responseFilter = signal<ResponseFilter>('all');

  // ==================== DETAIL MODAL ====================
  protected readonly selectedReview = signal<Review | null>(null);
  protected readonly showDetailModal = signal(false);
  protected readonly responseDraft = signal('');
  protected readonly isSavingResponse = signal(false);
  protected readonly isDeletingResponse = signal(false);
  protected readonly modalError = signal<string | null>(null);
  protected readonly responseMaxLength = 1000;

  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly hasResponseDraft = computed(() => this.responseDraft().trim().length > 0);

  constructor() {
    effect(() => {
      if (this.showDetailModal() && !this.hasScrollLock) {
        this.scrollLock.lock();
        this.hasScrollLock = true;
      } else if (!this.showDetailModal() && this.hasScrollLock) {
        this.scrollLock.unlock();
        this.hasScrollLock = false;
      }
    });
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadReviews();
  }

  ngOnDestroy(): void {
    if (this.hasScrollLock) {
      this.scrollLock.unlock();
      this.hasScrollLock = false;
    }
  }

  // ==================== LOAD ====================

  protected loadReviews(page = 1): void {
    this.isLoading.set(true);

    const rating = this.ratingFilter();
    const resp = this.responseFilter();
    const filters = {
      rating: rating === 'all' ? undefined : rating,
      hasResponse: resp === 'all' ? undefined : resp === 'with',
    };

    this.reviewService.getAllAdmin(page, this.pageLimit, filters).subscribe({
      next: (res) => {
        this.reviews.set(res.data);
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.total.set(res.pagination.total);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadSummary(): void {
    this.reviewService.getSummaryAdmin().subscribe({
      next: (res) => this.summary.set(res.data),
      error: () => { /* non-critical */ },
    });
  }

  // ==================== FILTERS ====================

  protected setRatingFilter(value: RatingFilter | number): void {
    this.ratingFilter.set(value as RatingFilter);
    this.loadReviews(1);
  }

  protected setResponseFilter(value: ResponseFilter): void {
    this.responseFilter.set(value);
    this.loadReviews(1);
  }

  // ==================== HELPERS ====================

  protected getClientName(review: Review): string {
    const u = review.user;
    if (typeof u === 'object' && u) {
      return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Sin nombre';
    }
    return '—';
  }

  protected getClientEmail(review: Review): string {
    const u = review.user;
    if (typeof u === 'object' && u) return u.email ?? '—';
    return '—';
  }

  protected getClientPhone(review: Review): string {
    const u = review.user;
    if (typeof u === 'object' && u) return u.phone ?? '—';
    return '—';
  }

  protected getClientAvatar(review: Review): string | null {
    const u = review.user;
    if (typeof u === 'object' && u && (u as ReviewUserPopulated).avatar) {
      return (u as ReviewUserPopulated).avatar ?? null;
    }
    return null;
  }

  protected getDispatchLabel(type: string): string {
    return DISPATCH_TYPE_SHORT_LABELS[type] || type;
  }

  protected hasResponse(review: Review): boolean {
    return !!review.adminResponse?.text;
  }

  // ==================== DETAIL MODAL ====================

  protected openDetail(review: Review): void {
    this.selectedReview.set(review);
    this.responseDraft.set(review.adminResponse?.text ?? '');
    this.modalError.set(null);
    this.showDetailModal.set(true);
  }

  protected closeDetail(): void {
    if (this.isSavingResponse() || this.isDeletingResponse()) return;
    this.showDetailModal.set(false);
    this.selectedReview.set(null);
    this.responseDraft.set('');
    this.modalError.set(null);
  }

  protected onResponseInput(event: Event): void {
    this.responseDraft.set((event.target as HTMLTextAreaElement).value);
  }

  protected saveResponse(): void {
    const review = this.selectedReview();
    const text = this.responseDraft().trim();
    if (!review || !text) return;

    this.isSavingResponse.set(true);
    this.modalError.set(null);

    this.reviewService.respondAdmin(review.id, { text }).subscribe({
      next: (res) => {
        this.isSavingResponse.set(false);
        this.patchLocalReview(res.data);
        this.selectedReview.set(res.data);
      },
      error: (err) => {
        this.isSavingResponse.set(false);
        this.modalError.set(err?.error?.message ?? 'No pudimos guardar la respuesta');
      },
    });
  }

  protected deleteResponse(): void {
    const review = this.selectedReview();
    if (!review || !review.adminResponse) return;

    this.isDeletingResponse.set(true);
    this.modalError.set(null);

    this.reviewService.deleteResponseAdmin(review.id).subscribe({
      next: (res) => {
        this.isDeletingResponse.set(false);
        this.responseDraft.set('');
        this.patchLocalReview(res.data);
        this.selectedReview.set(res.data);
      },
      error: (err) => {
        this.isDeletingResponse.set(false);
        this.modalError.set(err?.error?.message ?? 'No pudimos eliminar la respuesta');
      },
    });
  }

  private patchLocalReview(updated: Review): void {
    this.reviews.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    // Refresh summary after mutations affecting "withoutResponse"
    this.loadSummary();
  }
}
