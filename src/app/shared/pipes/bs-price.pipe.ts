import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bsPrice',
  standalone: true,
})
export class BsPricePipe implements PipeTransform {
  transform(usdPrice: number, rate: number | null): string {
    if (!rate || rate <= 0 || usdPrice == null) return '';
    const bs = usdPrice * rate;
    return `Bs ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
