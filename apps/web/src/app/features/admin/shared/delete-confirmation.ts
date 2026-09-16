import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  output,
  ViewChild,
} from "@angular/core";
import { AdminI18nService } from "./admin-i18n.service";

@Component({
  selector: "app-admin-delete-confirmation",
  templateUrl: "./delete-confirmation.html",
  styleUrl: "./catalog.scss",
})
export class DeleteConfirmation implements AfterViewInit, OnDestroy {
  readonly i18n = inject(AdminI18nService);
  @Input({ required: true }) name = "";
  readonly decision = output<boolean>();
  @ViewChild("cancel") cancel!: ElementRef<HTMLButtonElement>;
  @ViewChild("confirm") confirm!: ElementRef<HTMLButtonElement>;
  private readonly opener = document.activeElement as HTMLElement | null;
  ngAfterViewInit(): void {
    this.cancel.nativeElement.focus();
  }
  ngOnDestroy(): void {
    this.opener?.focus();
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.decision.emit(false);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const target =
        document.activeElement === this.cancel.nativeElement
          ? this.confirm
          : this.cancel;
      target.nativeElement.focus();
    }
  }
}
