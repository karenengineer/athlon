/**
 * SSR calls the internal API origin while the browser calls its own. The HTTP
 * transfer cache keys on the URL, so the two must be mapped or every hydrated
 * page refetches, and fails for crawlers that cannot reach the API.
 */
export function apiTransferOriginMap(
  apiBaseUrl: string,
  requestUrl: string | undefined,
): Record<string, string> {
  if (!requestUrl) return {};
  const apiOrigin = new URL(apiBaseUrl).origin;
  const publicOrigin = new URL(requestUrl).origin;
  return apiOrigin === publicOrigin ? {} : { [apiOrigin]: publicOrigin };
}
