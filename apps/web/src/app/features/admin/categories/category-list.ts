import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AdminCategory, AdminListQuery } from "../shared/admin-api.types";
import { CatalogListState } from "../shared/catalog-list-state";
import { DeleteConfirmation } from "../shared/delete-confirmation";
@Component({
  selector: "app-admin-category-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./category-list.html",
  styleUrl: "../shared/catalog.scss",
})
export class CategoryList extends CatalogListState<AdminCategory> {
  readonly resource = "categories";
  constructor() {
    super();
    this.initialize();
  }
  protected fetch(query: AdminListQuery) {
    return this.api.listCategories(query);
  }
  protected remove(id: string) {
    return this.api.deleteCategory(id);
  }
}
