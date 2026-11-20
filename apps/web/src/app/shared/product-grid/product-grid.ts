import { Component, input } from "@angular/core";
import { Product } from "../../core/api/catalog.models";
import { ProductCard } from "../product-card/product-card";

@Component({
  selector: "app-product-grid",
  imports: [ProductCard],
  template: `
    <div class="product-grid" [class.has-insert]="insertAfterFirstRow()">
      @for (product of products(); track product.id; let index = $index) {
        <app-product-card
          [product]="product"
          [eager]="eagerFirstRow() && index < 4"
        />
      }
      <ng-content />
    </div>
  `,
  styles: `
    .product-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }
    /* Projected content (marked with an order of 1 by its owner) sits after the first row. */
    .has-insert > app-product-card:nth-of-type(n + 5) {
      order: 2;
    }
    @media (max-width: 960px) {
      .product-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .has-insert > app-product-card:nth-of-type(n + 4) {
        order: 2;
      }
    }
    @media (max-width: 700px) {
      .product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .has-insert > app-product-card:nth-of-type(n + 3) {
        order: 2;
      }
    }
    @media (max-width: 360px) {
      .product-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }
      .has-insert > app-product-card:nth-of-type(n + 2) {
        order: 2;
      }
    }
  `,
})
export class ProductGrid {
  readonly products = input.required<Product[]>();
  readonly eagerFirstRow = input(false);
  /** Places projected content after the first row of cards at every breakpoint. */
  readonly insertAfterFirstRow = input(false);
}
