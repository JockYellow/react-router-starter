// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"), // <--- 修正這行
  route("about", "routes/about.tsx")
] satisfies RouteConfig;