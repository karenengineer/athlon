import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";
import {
  AdminBrand,
  AdminBrandInput,
  AdminCategory,
  AdminCategoryInput,
  AdminList,
  AdminListQuery,
  AdminProduct,
  AdminProductInput,
  AdminProductListItem,
  AdminProductQuery,
  AdminProductWrite,
  AdminImage,
  AdminImageInput,
} from "./admin-api.types";

@Injectable({ providedIn: "root" })
export class AdminCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = "/api/v1/admin";
  listCategories(
    query: AdminListQuery = {},
  ): Observable<AdminList<AdminCategory>> {
    return this.list("categories", query);
  }
  getCategory(id: string): Observable<AdminCategory> {
    return this.http.get<AdminCategory>(`${this.base}/categories/${id}`);
  }
  createCategory(input: AdminCategoryInput): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(`${this.base}/categories`, input);
  }
  updateCategory(
    id: string,
    input: Partial<AdminCategoryInput>,
  ): Observable<AdminCategory> {
    return this.http.patch<AdminCategory>(
      `${this.base}/categories/${id}`,
      input,
    );
  }
  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }
  listBrands(query: AdminListQuery = {}): Observable<AdminList<AdminBrand>> {
    return this.list("brands", query);
  }
  getBrand(id: string): Observable<AdminBrand> {
    return this.http.get<AdminBrand>(`${this.base}/brands/${id}`);
  }
  createBrand(input: AdminBrandInput): Observable<AdminBrand> {
    return this.http.post<AdminBrand>(`${this.base}/brands`, input);
  }
  updateBrand(
    id: string,
    input: Partial<AdminBrandInput>,
  ): Observable<AdminBrand> {
    return this.http.patch<AdminBrand>(`${this.base}/brands/${id}`, input);
  }
  deleteBrand(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/brands/${id}`);
  }
  listProducts(
    query: AdminProductQuery = {},
  ): Observable<AdminList<AdminProductListItem>> {
    return this.list("products", query);
  }
  getProduct(id: string): Observable<AdminProduct> {
    return this.http.get<AdminProduct>(`${this.base}/products/${id}`);
  }
  createProduct(input: AdminProductInput): Observable<AdminProductWrite> {
    return this.http.post<AdminProductWrite>(`${this.base}/products`, input);
  }
  updateProduct(
    id: string,
    input: Partial<AdminProductInput>,
  ): Observable<AdminProductWrite> {
    return this.http.patch<AdminProductWrite>(
      `${this.base}/products/${id}`,
      input,
    );
  }
  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/products/${id}`);
  }
  uploadImage(
    productId: string,
    file: File,
    fields: AdminImageInput,
  ): Observable<AdminImage> {
    const body = new FormData();
    body.append("file", file);
    for (const [key, value] of Object.entries(fields))
      if (value !== undefined) body.append(key, String(value));
    return this.http.post<AdminImage>(
      `${this.base}/products/${productId}/images`,
      body,
    );
  }
  orderImages(
    productId: string,
    images: { id: string; position: number }[],
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/products/${productId}/images/order`,
      { images },
    );
  }
  updateImage(
    productId: string,
    imageId: string,
    input: Partial<AdminImageInput>,
  ): Observable<AdminImage> {
    return this.http.patch<AdminImage>(
      `${this.base}/products/${productId}/images/${imageId}`,
      input,
    );
  }
  deleteImage(productId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/products/${productId}/images/${imageId}`,
    );
  }
  allBrands(page = 1): Observable<AdminBrand[]> {
    return this.listBrands({ page, pageSize: 100, sort: "order" }).pipe(
      switchMap((list) =>
        list.meta.page < list.meta.totalPages
          ? this.allBrands(page + 1).pipe(
              map((rest) => [...list.items, ...rest]),
            )
          : of(list.items),
      ),
    );
  }
  // Admin options deliberately include drafts and traverse every server page.
  allCategories(page = 1): Observable<AdminCategory[]> {
    return this.listCategories({ page, pageSize: 100, sort: "order" }).pipe(
      switchMap((list) =>
        list.meta.page < list.meta.totalPages
          ? this.allCategories(page + 1).pipe(
              map((rest) => [...list.items, ...rest]),
            )
          : of(list.items),
      ),
    );
  }
  private list<T>(
    resource: "categories" | "brands" | "products",
    query: AdminListQuery | AdminProductQuery,
  ): Observable<AdminList<T>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "") params = params.set(key, value);
    return this.http.get<AdminList<T>>(`${this.base}/${resource}`, { params });
  }
}
