import { Component, inject, input, output } from "@angular/core";
import { I18nService } from "../../core/i18n/i18n.service";

@Component({
  selector: "app-status-panel",
  template: `
    <section
      class="status"
      [class.loading]="kind() === 'loading'"
      [attr.data-testid]="testId()"
      role="status"
    >
      @if (kind() === "loading") {
        <div class="skeletons" aria-hidden="true">
          @for (item of [1, 2, 3, 4]; track item) {
            <span></span>
          }
        </div>
        <p>{{ i18n.t("loading") }}</p>
      } @else {
        <span class="mark" aria-hidden="true">{{
          kind() === "error" ? "!" : "·"
        }}</span>
        <h2>{{ i18n.t(kind() === "error" ? "errorTitle" : "emptyTitle") }}</h2>
        <p>{{ i18n.t(kind() === "error" ? "errorText" : "emptyText") }}</p>
        @if (kind() === "error") {
          <button type="button" data-testid="retry-home" (click)="retry.emit()">
            {{ i18n.t("retry") }}
          </button>
        }
      }
    </section>
  `,
  styles: `
    .status {
      min-height: 260px;
      display: grid;
      place-content: center;
      justify-items: center;
      padding: 30px;
      text-align: center;
      border: 1px solid #dddde1;
      border-radius: 10px;
      background: #fff;
    }
    .status h2 {
      margin: 12px 0 5px;
      color: #171719;
    }
    .status p {
      margin: 0;
      color: #6e6e74;
    }
    .mark {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: #e5001b;
      font-weight: 900;
    }
    button {
      margin-top: 18px;
      padding: 11px 20px;
      border: 0;
      border-radius: 5px;
      color: #fff;
      background: #e5001b;
      font-weight: 800;
      cursor: pointer;
    }
    .loading {
      display: block;
    }
    .loading p {
      margin-top: 12px;
      text-align: center;
    }
    .skeletons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
    }
    .skeletons span {
      height: 250px;
      border-radius: 8px;
      background: linear-gradient(
        100deg,
        #ececef 20%,
        #f7f7f8 45%,
        #ececef 70%
      );
      background-size: 200% 100%;
      animation: shimmer 1.2s infinite;
    }
    @keyframes shimmer {
      to {
        background-position-x: -200%;
      }
    }
    @media (max-width: 700px) {
      .skeletons {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .skeletons span {
        height: 210px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeletons span {
        animation: none;
      }
    }
  `,
})
export class StatusPanel {
  readonly kind = input.required<"loading" | "empty" | "error">();
  readonly retry = output<void>();
  readonly i18n = inject(I18nService);

  testId(): string {
    return `home-${this.kind()}`;
  }
}
