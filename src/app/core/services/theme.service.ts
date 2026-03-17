import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'e-commerce-theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Signal que mantiene el tema actual */
  readonly theme = signal<Theme>(this.getInitialTheme());

  /** Signal computado para saber si está en modo oscuro */
  readonly isDark = () => this.theme() === 'dark';

  constructor() {
    // Efecto para aplicar el tema cuando cambie
    effect(() => {
      this.applyTheme(this.theme());
    });
  }

  /**
   * Obtiene el tema inicial basado en:
   * 1. Preferencia guardada en localStorage
   * 2. Preferencia del sistema operativo
   */
  private getInitialTheme(): Theme {
    if (!this.isBrowser) {
      return 'light';
    }

    // Verificar si hay una preferencia guardada
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme;
    }

    // Usar preferencia del sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /**
   * Aplica el tema al documento
   */
  private applyTheme(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }

    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Guardar preferencia
    localStorage.setItem(THEME_KEY, theme);
  }

  /**
   * Alterna entre modo claro y oscuro
   */
  toggleTheme(): void {
    this.theme.update(current => current === 'light' ? 'dark' : 'light');
  }

  /**
   * Establece un tema específico
   */
  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }
}