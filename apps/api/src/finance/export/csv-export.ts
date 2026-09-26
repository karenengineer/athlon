export type CsvCell = string | number | boolean | Date | null | undefined;

const BOM = "\uFEFF";
const FORMULA_PREFIX = /^[=+\-@]/;
const DECIMAL_TEXT = /^-?\d+(?:\.\d+)?$/;

function serializeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string" &&
          FORMULA_PREFIX.test(value) &&
          !DECIMAL_TEXT.test(value)
        ? `'${value}`
        : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): Buffer {
  const lines = [headers.map(serializeCell).join(",")];
  lines.push(...rows.map((row) => row.map(serializeCell).join(",")));
  return Buffer.from(`${BOM}${lines.join("\r\n")}`, "utf8");
}
