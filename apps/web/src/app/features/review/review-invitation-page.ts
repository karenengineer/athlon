import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import {
  ReviewInvitation,
  ReviewInvitationItem,
} from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { createPageMetadata } from "../../core/seo/page-metadata";
import { starsText } from "../product/product-reviews";
import { reviewInvitationCopy } from "./review-invitation-copy";

type LoadState = "LOADING" | "READY" | "NOT_FOUND" | "EXPIRED" | "ERROR";
type ItemState = "idle" | "sending" | "sent" | "error" | "duplicate";

interface ItemForm {
  rating: number;
  body: string;
  touched: boolean;
  state: ItemState;
}

/**
 * The buyer's personal review page, opened from the email sent after
 * delivery. Each product in the order can be reviewed once.
 */
@Component({
  selector: "app-review-invitation-page",
  imports: [RouterLink],
  templateUrl: "./review-invitation-page.html",
  styleUrl: "./review-invitation-page.scss",
})
export class ReviewInvitationPage {
  readonly i18n = inject(I18nService);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();
  readonly copy = computed(() => reviewInvitationCopy[this.i18n.locale()]);
  readonly ratings = [5, 4, 3, 2, 1] as const;
  readonly starsText = starsText;
  readonly state = signal<LoadState>("LOADING");
  readonly invitation = signal<ReviewInvitation | null>(null);
  readonly authorName = signal("");
  readonly forms = signal<Record<string, ItemForm>>({});
  readonly allDone = computed(() => {
    const items = this.invitation()?.items ?? [];
    const forms = this.forms();
    return (
      items.length > 0 &&
      items.every(
        (item) => item.reviewed || forms[item.productId]?.state === "sent",
      )
    );
  });
  private token = "";

  constructor() {
    combineLatest([this.route.paramMap, this.route.parent!.paramMap])
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(([params, parent]) => {
        this.i18n.setLocale(parent.get("locale"));
        this.metadata.set({
          title: `${this.copy().title} | ATHLON`,
          description: this.copy().intro,
          noindex: true,
        });
        this.token = params.get("token") ?? "";
        this.load();
      });
  }

  private load(): void {
    this.state.set("LOADING");
    this.api.reviewInvitation(this.token, this.i18n.locale()).subscribe({
      next: (invitation) => {
        this.invitation.set(invitation);
        this.authorName.set(invitation.authorName);
        this.forms.set(
          Object.fromEntries(
            invitation.items.map((item) => [
              item.productId,
              { rating: 5, body: "", touched: false, state: "idle" as const },
            ]),
          ),
        );
        this.state.set("READY");
      },
      error: (error: unknown) => {
        const status =
          error instanceof HttpErrorResponse ? error.status : undefined;
        this.state.set(
          status === 410
            ? "EXPIRED"
            : status === 404 || status === undefined
              ? "NOT_FOUND"
              : "ERROR",
        );
      },
    });
  }

  form(item: ReviewInvitationItem): ItemForm {
    return (
      this.forms()[item.productId] ?? {
        rating: 5,
        body: "",
        touched: false,
        state: "idle",
      }
    );
  }

  patch(item: ReviewInvitationItem, change: Partial<ItemForm>): void {
    this.forms.update((forms) => ({
      ...forms,
      [item.productId]: { ...this.form(item), ...change },
    }));
  }

  nameInvalid(): boolean {
    const name = this.authorName().trim();
    return name.length < 2 || name.length > 80;
  }

  bodyInvalid(item: ReviewInvitationItem): boolean {
    const body = this.form(item).body.trim();
    return body.length < 10 || body.length > 2000;
  }

  submit(item: ReviewInvitationItem, event: Event): void {
    event.preventDefault();
    const form = this.form(item);
    if (form.state === "sending" || form.state === "sent") return;
    this.patch(item, { touched: true });
    if (this.nameInvalid() || this.bodyInvalid(item)) return;
    this.patch(item, { state: "sending" });
    this.api
      .submitInvitedReview(this.token, {
        productId: item.productId,
        authorName: this.authorName().trim(),
        rating: form.rating,
        body: form.body.trim(),
        locale: this.i18n.locale(),
      })
      .subscribe({
        next: () => this.patch(item, { state: "sent" }),
        error: (error: unknown) => {
          const status =
            error instanceof HttpErrorResponse ? error.status : undefined;
          if (status === 410) this.state.set("EXPIRED");
          this.patch(item, {
            state: status === 409 ? "duplicate" : "error",
          });
        },
      });
  }
}
