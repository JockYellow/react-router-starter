import { type RouteConfig, index, route } from "@react-router/dev/routes"; // 1. 匯入 route

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx") // 2. 加入這行來定義 /about 路由
] satisfies RouteConfig;
