import { Component, input } from "@angular/core";
import { Product } from "../../core/api/catalog.models";
import { ProductCard } from "../product-card/product-card";

@Component({
  selector: "app-product-grid",
  imports: [ProductCard],
  template: `
    <div class="product-grid">
      @for (product of products(); track product.id; let index = $index) {
        <app-product-card
          [product]="product"
          [eager]="eagerFirstRow() && index < 4"
        />
      }
    </div>
  `,
  styles: `
    .product-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }
    @media (max-width: 960px) {
      .product-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 700px) {
      .product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }
  `,
})
export class ProductGrid {
  readonly products = input.required<Product[]>();
  readonly eagerFirstRow = input(false);
}
