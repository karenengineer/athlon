import { Component, input } from "@angular/core";

export interface ChartPoint {
  label: string;
  value: number;
}

@Component({
  selector: "app-finance-simple-chart",
  templateUrl: "./simple-chart.html",
})
export class SimpleChart {
  readonly title = input.required<string>();
  readonly points = input.required<ChartPoint[]>();
  width(value: number): number {
    const maximum = Math.max(
      0,
      ...this.points().map((point) => Math.abs(point.value)),
    );
    return maximum ? Math.round((Math.abs(value) / maximum) * 100) : 0;
  }
}
