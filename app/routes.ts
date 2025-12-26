// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";


export default [
  index("routes/missing.tsx"),
  route("jock_space", "routes/_index.tsx"),
  route("about", "routes/about.tsx"),
  route("blog", "routes/blog.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("changelog", "routes/changelog.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/blog-edit", "routes/admin.blog-edit.tsx"),
  route("admin", "routes/admin.tsx"),
  route("api/admin", "routes/api.admin.tsx"),
  route("api/data", "routes/api.data.tsx"),
  route("api/output-configs", "routes/api.output-configs.tsx"),
  route("outerspace", "routes/outerspace/index.tsx"),
  route("outerspace/OuterSpaceSenter", "routes/outerspace/OuterSpaceSenter.tsx"),
  route("outerspace/PokeAPIcreatures", "routes/outerspace/PokeAPIcreatures.tsx"),
  route("outerspace/Gravity", "routes/outerspace/Gravity.tsx"),
  route("gift", "routes/gift.tsx"),
  route("gift/host", "routes/gift.host.tsx"),
  route("vote", "routes/vote.tsx"),
  route("rng_prompt", "routes/rng_prompt.tsx"),
] satisfies RouteConfig;
