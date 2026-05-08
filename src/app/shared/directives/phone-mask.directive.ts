import { Directive, HostListener, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Filtro reactivo para inputs de teléfono venezolano (04XX-XXXXXXX o
 * 04XXXXXXXXXX). Acepta solo dígitos y guión, recortando a 12 caracteres.
 *
 * Uso:
 *   <input formControlName="phone" appPhoneMask />
 *
 * Sin esta directiva, el browser permite teclear o pegar letras y otros
 * símbolos que después fallan la validación regex pero ya están visibles
 * en el campo. La directiva escribe el valor saneado de vuelta al DOM
 * y al FormControl en el mismo tick.
 */
@Directive({
  selector: 'input[appPhoneMask]',
  standalone: true,
})
export class PhoneMaskDirective {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly ngControl = inject(NgControl, { optional: true });

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const cleaned = input.value.replace(/[^\d-]/g, '').slice(0, 12);
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
    this.ngControl?.control?.setValue(cleaned, { emitEvent: false });
  }
}
