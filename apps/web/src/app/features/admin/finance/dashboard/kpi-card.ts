import { Component, input } from "@angular/core";

@Component({ selector: "app-finance-kpi-card", templateUrl: "./kpi-card.html" })
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly comparisonPercent = input<string | null>(null);
  readonly tone = input<"default" | "positive" | "negative">("default");
}
