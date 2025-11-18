// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"), 
  route("about", "routes/about.tsx"),
  route("blog", "routes/blog.tsx"),
  route("changelog", "routes/changelog.tsx"),
] satisfies RouteConfig;
