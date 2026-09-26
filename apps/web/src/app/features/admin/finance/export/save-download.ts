import { FinanceDownload } from "../shared/finance-api.types";

/** The API supplies a sanitized filename. Keep the object URL alive through the click. */
export function saveFinanceDownload(download: FinanceDownload): void {
  const url = URL.createObjectURL(download.blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = download.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
