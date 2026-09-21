import { toCsv } from "./csv-export";

describe("toCsv", () => {
  it("emits BOM-prefixed RFC CSV and neutralizes formula-like text", () => {
    const result = toCsv(
      ["Name", "Amount", "Note"],
      [
        ["=SUM(A1:A2)", 120000, 'comma, quote " and\nnewline'],
        ["safe", -25, null],
      ],
    ).toString("utf8");

    expect(result).toBe(
      '\uFEFFName,Amount,Note\r\n\'=SUM(A1:A2),120000,"comma, quote "" and\nnewline"\r\nsafe,-25,',
    );
  });

  it.each(["=1+1", "+cmd", "-command", "@SUM(A1)"])(
    "prefixes unsafe text %s while leaving numeric values numeric",
    (unsafe) => {
      const result = toCsv(["Text", "Number"], [[unsafe, -100]]).toString(
        "utf8",
      );

      expect(result).toBe(`\uFEFFText,Number\r\n'${unsafe},-100`);
    },
  );
});
