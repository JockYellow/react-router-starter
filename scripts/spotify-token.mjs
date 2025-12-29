import http from "node:http";
import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { execa } from "execa";

const args = process.argv.slice(2);
const skipImport = args.includes("--no-import") || args.includes("--token-only");
const importArgs = args.filter((arg) => ["--local", "--remote", "--no-exec"].includes(arg));
const scope = "user-follow-read";

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const entries = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

async function loadEnvFile() {
  const envPath = process.env.SPOTIFY_ENV_FILE || path.join(process.cwd(), ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to read .env:", err);
    }
  }
}

await loadEnvFile();

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8888/callback";

if (!clientId || !clientSecret) {
  console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.");
  process.exit(1);
}

const authorizeUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  redirect_uri: redirectUri,
  scope,
  show_dialog: "true",
}).toString()}`;

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "win32") {
    exec(`cmd.exe /c start "" "${url}"`);
    return true;
  }
  if (platform === "darwin") {
    exec(`open "${url}"`);
    return true;
  }
  exec(`xdg-open "${url}"`, (error) => {
    if (error) {
      console.log("Open this URL in your browser:");
      console.log(url);
    }
  });
  return true;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Token exchange failed: ${res.status}`);
  }

  return res.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "", redirectUri);

  if (url.pathname !== new URL(redirectUri).pathname) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Authorization error: ${error}`);
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing authorization code.");
    return;
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <h2>Spotify Access Token</h2>
    <p>Copy the token from the terminal and close this window.</p>
  </body>
</html>`);

    console.log("\nAccess token:");
    console.log(accessToken);
    console.log(`\nValid for ~${Math.floor((expiresIn || 0) / 60)} minutes.`);

    if (skipImport) {
      console.log("\nImport command:");
      console.log(`SPOTIFY_USER_TOKEN=${accessToken} npm run spotify:import`);
    } else {
      console.log("\nStarting import...");
      await execa(process.execPath, ["scripts/spotify-import.mjs", ...importArgs], {
        stdio: "inherit",
        env: {
          ...process.env,
          SPOTIFY_USER_TOKEN: accessToken,
        },
      });
      console.log("\nImport finished.");
    }
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Token exchange failed. See terminal for details.");
    console.error(err);
  } finally {
    server.close();
  }
});

const port = new URL(redirectUri).port || "8888";
const hostname = new URL(redirectUri).hostname || "127.0.0.1";

server.listen(Number(port), hostname, () => {
  console.log("Local callback server running.");
  console.log(`Redirect URI: ${redirectUri}`);
  console.log("Opening browser for Spotify authorization...");
  openBrowser(authorizeUrl);
});
