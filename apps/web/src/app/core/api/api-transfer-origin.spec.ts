import { apiTransferOriginMap } from "./api-transfer-origin";

describe("apiTransferOriginMap", () => {
  it("keys server API responses under the origin the browser requests", () => {
    expect(
      apiTransferOriginMap(
        "http://api:3000/api/v1",
        "https://athlon.am/en/product/whey?utm_source=x",
      ),
    ).toEqual({ "http://api:3000": "https://athlon.am" });
  });

  it("maps nothing without a request or when the origins already match", () => {
    expect(apiTransferOriginMap("http://api:3000/api/v1", undefined)).toEqual(
      {},
    );
    expect(
      apiTransferOriginMap("http://web:4000/api/v1", "http://web:4000/hy"),
    ).toEqual({});
  });
});
