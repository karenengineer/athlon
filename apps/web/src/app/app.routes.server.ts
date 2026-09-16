import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  {
    path: "admin",
    renderMode: RenderMode.Client,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  },
  {
    path: "admin/**",
    renderMode: RenderMode.Client,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  },
  {
    path: "**",
    renderMode: RenderMode.Server,
  },
];
