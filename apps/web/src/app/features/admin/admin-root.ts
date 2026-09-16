import { Component, OnDestroy, inject } from "@angular/core";
import { Meta } from "@angular/platform-browser";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-admin-root",
  imports: [RouterOutlet],
  template: "<router-outlet />",
})
export class AdminRoot implements OnDestroy {
  private readonly meta = inject(Meta);
  private readonly previous = this.meta.getTag('name="robots"')?.content;
  constructor() {
    this.meta.updateTag({ name: "robots", content: "noindex, nofollow" });
  }
  ngOnDestroy(): void {
    if (this.previous)
      this.meta.updateTag({ name: "robots", content: this.previous });
    else this.meta.removeTag('name="robots"');
  }
}
