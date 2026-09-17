#!/usr/bin/env bash
set -euo pipefail
# Fixed approved hosts; normal CA verification and bounded IO.
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 30)
JSON=(node)
if ! command -v node >/dev/null 2>&1; then
  JSON=(timeout --kill-after=5 20 docker compose --env-file .env -f infrastructure/docker-compose.production.yml exec -T api node)
fi
validate_json() {
  # Explicit piped data and Docker -T cannot consume the outer SSH program stdin.
  "${JSON[@]}" -e '
    const timer = setTimeout(() => process.exit(1), 15000);
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { input += chunk; if (input.length > 1048576) process.exit(1); });
    process.stdin.on("end", () => {
      try {
        const value = JSON.parse(input);
        const valid = process.argv[1] === "health"
          ? value?.status === "ok"
          : Array.isArray(value?.items) && value.meta &&
            ["page", "pageSize", "total", "totalPages"].every(key => Number.isInteger(value.meta[key])) &&
            value.meta.page === 1 && value.meta.pageSize === 1 && value.meta.total >= 0 && value.meta.totalPages >= 0;
        clearTimeout(timer); if (!valid) process.exit(1);
      } catch { process.exit(1); }
    });' "$1"
}
"${CURL[@]}" https://athlonsport.am/api/v1/health/live | validate_json health
for locale in hy ru en; do
  "${CURL[@]}" --output /dev/null "https://athlonsport.am/$locale"
  "${CURL[@]}" "https://athlonsport.am/api/v1/products?locale=$locale&page=1&pageSize=1" | validate_json products
done
"${CURL[@]}" --location --max-redirs 3 --proto '=https' --proto-redir '=https' --output /dev/null https://www.athlonsport.am/hy
headers="$("${CURL[@]}" --dump-header - --output /dev/null https://athlonsport.am/hy)"
printf '%s\n' "$headers" | tr -d '\r' | grep -Eiq '^strict-transport-security:[[:space:]]*max-age=[1-9][0-9]*(;|[[:space:]]|$)'
redirect="$("${CURL[@]}" --dump-header - --output /dev/null http://athlonsport.am/)"
printf '%s\n' "$redirect" | tr -d '\r' | grep -Eq '^HTTP/[0-9.]+ 30[1278]([[:space:]]|$)'
printf '%s\n' "$redirect" | tr -d '\r' | grep -Eiq '^location:[[:space:]]*https://athlonsport\.am/([[:space:]]|$)'
printf 'Production public smoke passed.\n'
