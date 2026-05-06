import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Shared shell for legal pages (Terms, Privacy, Cookies). Provides the hero
 * header (back arrow + title + subtitle + last-updated stamp), a max-width
 * content column — so the page components only own their actual prose,
 * never repeat layout chrome.
 */
@Component({
  selector: 'app-legal-page-layout',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page-layout.component.html',
  styleUrl: './legal-page-layout.component.scss',
})
export class LegalPageLayoutComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Big title shown in the hero. */
  readonly title = input.required<string>();

  /** Short subtitle below the title — sets the page's intent in one line. */
  readonly subtitle = input<string>('');

  /** ISO date of the last revision; rendered in long Spanish form. */
  readonly lastUpdated = input<string>('');

  /**
   * Navigate to the previous entry in the browser history. When the user
   * landed here directly (shared link, new tab) the history is empty, so
   * fall back to the home page to avoid leaving the SPA.
   */
  protected goBack(): void {
    const hasHistory = (globalThis.history?.length ?? 0) > 1;
    if (hasHistory) {
      this.location.back();
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
