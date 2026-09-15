import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { API_BASE_URL } from "./api-base-url";
import {
  Brand,
  Category,
  Product,
  ProductPageResponse,
  ProductQuery,
  PublicSettings,
} from "./catalog.models";

@Injectable({ providedIn: "root" })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  categories(locale: string): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`, {
      params: { locale },
    });
  }

  brands(locale: string): Observable<Brand[]> {
    return this.http.get<Brand[]>(`${this.baseUrl}/brands`, {
      params: { locale },
    });
  }

  products(query: ProductQuery): Observable<ProductPageResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<ProductPageResponse>(`${this.baseUrl}/products`, {
      params,
    });
  }

  product(slug: string, locale: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${slug}`, {
      params: { locale },
    });
  }

  settings(): Observable<PublicSettings> {
    return this.http.get<PublicSettings>(`${this.baseUrl}/public/settings`);
  }
}
