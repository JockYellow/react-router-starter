import type { LoaderFunctionArgs } from "react-router";

import { getSpotifyEnv } from "../../features/spotify/spotify.server";

function renderHtml(message: string, script?: string) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Spotify 授權中...</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
      .wrap { max-width: 560px; margin: 12vh auto; padding: 32px; background: #fff; border-radius: 24px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08); }
      h1 { font-size: 1.4rem; margin: 0 0 12px; }
      p { margin: 0; line-height: 1.6; color: #475569; }
      a { color: #16a34a; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Spotify 授權中</h1>
      <p>${message}</p>
    </div>
    ${script ?? ""}
  </body>
</html>`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error) {
    const html = renderHtml(`授權失敗：${error}。請回到頁面重新嘗試。`);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (!code) {
    const html = renderHtml("沒有收到授權碼，請重新登入 Spotify。", "");
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { clientId, clientSecret, redirectUri } = getSpotifyEnv(context, request.url);
  const credentials = `${clientId}:${clientSecret}`;
  if (typeof btoa !== "function") {
    throw new Response("Base64 encoder is unavailable", { status: 500 });
  }
  const encoded = btoa(credentials);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    const html = renderHtml(`授權交換失敗：${errorText || tokenRes.status}`);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  const safePayload = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_in: tokenData.expires_in ?? 0,
    token_type: tokenData.token_type ?? "Bearer",
  };

  const html = renderHtml(
    "授權完成，正在回到 Spotify 排位賽...",
    `<script>
      (function () {
        const payload = ${JSON.stringify(safePayload)};
        const expiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : null;
        const authState = {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          expiresAt,
        };
        try {
          localStorage.setItem("spotify_auth", JSON.stringify(authState));
        } catch (err) {
          console.error(err);
        }
        window.location.replace("/spotify");
      })();
    </script>`,
  );

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default function CallSpotifyFallback() {
  return null;
}
