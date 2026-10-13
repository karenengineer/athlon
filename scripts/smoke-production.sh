#!/usr/bin/env bash
set -euo pipefail
# Fixed approved hosts; normal CA verification and bounded IO.
CURL=(curl --disable --fail --silent --show-error --connect-timeout 10 --max-time 30)
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
"${CURL[@]}" https://athlon.am/api/v1/health/live | validate_json health
for locale in hy ru en; do
  "${CURL[@]}" --output /dev/null "https://athlon.am/$locale"
  "${CURL[@]}" "https://athlon.am/api/v1/products?locale=$locale&page=1&pageSize=1" | validate_json products
done
headers="$("${CURL[@]}" --dump-header - --output /dev/null https://athlon.am/hy)"
printf '%s\n' "$headers" | tr -d '\r' | grep -Eiq '^strict-transport-security:[[:space:]]*max-age=[1-9][0-9]*(;|[[:space:]]|$)'
redirect_path='/hy/catalog?page=2&sort=price'
for origin in \
  'http://www.athlon.am' \
  'https://www.athlon.am' \
  'http://athlonsport.am' \
  'https://athlonsport.am' \
  'http://www.athlonsport.am' \
  'https://www.athlonsport.am'; do
  redirect="$("${CURL[@]}" --dump-header - --output /dev/null "$origin$redirect_path")"
  redirect="$(printf '%s\n' "$redirect" | tr -d '\r')"
  printf '%s\n' "$redirect" | grep -Eq '^HTTP/[0-9.]+ 308([[:space:]]|$)'
  printf '%s\n' "$redirect" | grep -Eiq '^location:[[:space:]]*https://athlon\.am/hy/catalog\?page=2&sort=price[[:space:]]*$'
done
printf 'Production public smoke passed.\n'
