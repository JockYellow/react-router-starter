// toolbelt/admin/admin.js
window.Admin = (function () {
  const state = { key: "", config: { frontendUrl: null, apiBase: null }, configLoaded: false };

  async function initConfig() {
    if (state.configLoaded) return state.config;
    try {
      const res = await fetch("/config");
      if (res.ok) {
        const cfg = await res.json();
        state.config = cfg || {};
      }
    } catch (e) {
      console.warn("load config failed", e);
    } finally {
      state.configLoaded = true;
      applyFrontendLinks();
    }
    return state.config;
  }

  function applyFrontendLinks() {
    const href = state.config.frontendUrl || "/";
    document.querySelectorAll(".js-frontend-link").forEach((el) => {
      if (el instanceof HTMLAnchorElement) {
        el.href = href;
      }
    });
  }

  async function initKey() {
    if (state.key) return state.key;
    await initConfig();
    const res = await fetch("/key");
    if (!res.ok) throw new Error("no key");
    const { key } = await res.json();
    state.key = key;
    return key;
  }

  async function api(path, opt = {}) {
    await initKey();
    const res = await fetch(path, {
      method: opt.method || "GET",
      headers: {
        "content-type": "application/json",
        "x-toolbelt-key": state.key,
      },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function slugify(s) {
    return (s || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9\-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  (async () => {
    try {
      await initConfig();
    } catch {
      // ignore
    }
  })();

  return { api, today, slugify, initConfig, getConfig: () => state.config };
})();
