// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";


export default [
  index("routes/_index.tsx"), 
  route("about", "routes/about.tsx"),
  route("blog", "routes/blog.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("changelog", "routes/changelog.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/blog-edit", "routes/admin.blog-edit.tsx"),
  route("admin", "routes/admin.tsx"),
  route("outerspace", "routes/outerspace/index.tsx"),
  route("outerspace/OuterSpaceSenter", "routes/outerspace/OuterSpaceSenter.tsx"),
  route("outerspace/PokeAPIcreatures", "routes/outerspace/PokeAPIcreatures.tsx"),
  route("outerspace/Gravity", "routes/outerspace/Gravity.tsx"),
  route("vote", "routes/vote.tsx"),
] satisfies RouteConfig;
