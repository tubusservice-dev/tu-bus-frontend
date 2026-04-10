import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandService } from '../../../../../core/services/brand.service';
import { Brand } from '../../../../../models/product.model';

@Component({
  selector: 'app-tubus-brands',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tubus-brands.component.html',
  styleUrl: './tubus-brands.component.scss'
})
export class TubusBrandsComponent implements OnInit {
  private readonly brandService = inject(BrandService);

  protected readonly brands = signal<Brand[]>([]);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.loadBrands();
  }

  private loadBrands(): void {
    this.brandService.getAll().subscribe({
      next: (response) => {
        // Solo mostrar marcas activas
        const activeBrands = response.data.filter(b => b.isActive && b.image);
        this.brands.set(activeBrands);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }
}
