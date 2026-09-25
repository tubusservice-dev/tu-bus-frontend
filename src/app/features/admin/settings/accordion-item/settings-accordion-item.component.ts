import { Component, input, output } from '@angular/core';

/**
 * Collapsible shell shared by every section of the settings page: header
 * (icon, heading, chevron) plus the animated body. The section content is
 * projected, so it keeps its own component styles.
 */
@Component({
  selector: 'app-settings-accordion-item',
  standalone: true,
  templateUrl: './settings-accordion-item.component.html',
  styleUrl: './settings-accordion-item.component.scss',
})
export class SettingsAccordionItemComponent {
  readonly heading = input.required<string>();
  /** `d` attribute of the header icon path. */
  readonly iconPath = input.required<string>();
  readonly expanded = input(false);

  /** Emitted when the header is clicked; the parent decides what opens. */
  readonly toggled = output<void>();
}
