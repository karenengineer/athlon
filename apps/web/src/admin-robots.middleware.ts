import { RequestHandler } from "express";
export const adminRobotsMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  if (request.path === "/admin" || request.path.startsWith("/admin/"))
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
};
