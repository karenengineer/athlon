import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Request, Response } from "express";
import { adminRobotsMiddleware } from "./admin-robots.middleware";

describe("initial admin response indexing", () => {
  it.each([
    ["/admin", "noindex, nofollow"],
    ["/admin/login", "noindex, nofollow"],
    ["/admin/products", "noindex, nofollow"],
    ["/hy", undefined],
    ["/administrator", undefined],
  ])("sets header for %s", (path, expected) => {
    const request = new IncomingMessage(new Socket());
    Object.defineProperty(request, "path", { value: path });
    const response = new ServerResponse(request);
    let continued = false;
    adminRobotsMiddleware(
      request as unknown as Request,
      response as unknown as Response,
      () => (continued = true),
    );
    expect(response.getHeader("X-Robots-Tag")).toBe(expected);
    expect(continued).toBe(true);
  });
});
