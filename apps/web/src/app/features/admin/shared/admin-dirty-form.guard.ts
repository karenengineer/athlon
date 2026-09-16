import { CanDeactivateFn } from "@angular/router";
export interface AdminDirtyForm {
  hasUnsavedChanges(): boolean;
  confirmDiscard(): boolean;
}
export const adminDirtyFormGuard: CanDeactivateFn<AdminDirtyForm> = (
  component,
) => !component.hasUnsavedChanges() || component.confirmDiscard();
