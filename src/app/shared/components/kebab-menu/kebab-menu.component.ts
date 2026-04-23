import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KebabMenuAction {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  divider?: boolean;
}

@Component({
  selector: 'app-kebab-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kebab-menu.component.html',
  styleUrl: './kebab-menu.component.scss',
})
export class KebabMenuComponent {
  @Input({ required: true }) actions: KebabMenuAction[] = [];
  @Input() ariaLabel = 'Más acciones';
  @Output() select = new EventEmitter<string>();

  protected readonly open = signal(false);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  onSelect(action: KebabMenuAction, event: MouseEvent): void {
    event.stopPropagation();
    if (action.disabled || action.divider) return;
    this.open.set(false);
    this.select.emit(action.key);
  }

  visibleActions(): KebabMenuAction[] {
    return this.actions.filter((a) => !a.hidden);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open.set(false);
  }
}
