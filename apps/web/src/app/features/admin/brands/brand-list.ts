import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AdminBrand, AdminListQuery } from "../shared/admin-api.types";
import { CatalogListState } from "../shared/catalog-list-state";
import { DeleteConfirmation } from "../shared/delete-confirmation";
@Component({
  selector: "app-admin-brand-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./brand-list.html",
  styleUrl: "../shared/catalog.scss",
})
export class BrandList extends CatalogListState<AdminBrand> {
  readonly resource = "brands";
  constructor() {
    super();
    this.initialize();
  }
  protected fetch(query: AdminListQuery) {
    return this.api.listBrands(query);
  }
  protected remove(id: string) {
    return this.api.deleteBrand(id);
  }
  override name(item: AdminBrand): string {
    return (
      item.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.name ?? item.name
    );
  }
}
