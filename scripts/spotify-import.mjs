import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execa } from "execa";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const token = process.env.SPOTIFY_USER_TOKEN;
const datasetKey = (process.env.SPOTIFY_DATASET_KEY ?? "default").trim() || "default";
const shouldExec = !process.argv.includes("--no-exec");
const isLocal = process.argv.includes("--local");
const isRemote = process.argv.includes("--remote");
const target = isLocal ? "local" : isRemote ? "remote" : "remote";

if (!token) {
  console.error("Missing SPOTIFY_USER_TOKEN (needs user-follow-read scope).\n");
  console.error("Example: SPOTIFY_USER_TOKEN=... npm run spotify:import");
  process.exit(1);
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

async function fetchAllFollowedArtistIds(accessToken) {
  let url = `${SPOTIFY_API_BASE}/me/following?type=artist&limit=50`;
  const ids = [];
  let total = 0;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || `Spotify API error: ${res.status}`);
    }
    const data = await res.json();
    const items = data?.artists?.items ?? [];
    total = data?.artists?.total ?? total;
    for (const artist of items) {
      if (artist?.id) ids.push(artist.id);
    }
    console.log(`Fetched ${ids.length}${total ? ` / ${total}` : ""} artists...`);
    url = data?.artists?.next ?? null;
  }

  return ids;
}

const ids = await fetchAllFollowedArtistIds(token);
if (ids.length === 0) {
  console.error("No followed artists returned by Spotify.");
  process.exit(1);
}

const importedAt = Date.now();
const sqlLines = [
  "CREATE TABLE IF NOT EXISTS spotify_followed_artists (",
  "  dataset_key TEXT NOT NULL,",
  "  artist_id TEXT NOT NULL,",
  "  imported_at INTEGER NOT NULL,",
  "  PRIMARY KEY (dataset_key, artist_id)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_spotify_followed_artists_dataset ON spotify_followed_artists (dataset_key, imported_at);",
  `DELETE FROM spotify_followed_artists WHERE dataset_key = '${sqlEscape(datasetKey)}';`,
];

const chunkSize = 100;
for (let i = 0; i < ids.length; i += chunkSize) {
  const chunk = ids.slice(i, i + chunkSize);
  const values = chunk
    .map((id) => `('${sqlEscape(datasetKey)}','${sqlEscape(id)}',${importedAt})`)
    .join(",");
  sqlLines.push(`INSERT INTO spotify_followed_artists (dataset_key, artist_id, imported_at) VALUES ${values};`);
}

const sqlPath = path.join(process.cwd(), "sql", "spotify_followed_artists_import.sql");
await fs.mkdir(path.dirname(sqlPath), { recursive: true });
await fs.writeFile(sqlPath, `${sqlLines.join("\n")}\n`, "utf8");

console.log(`\nSQL written to ${sqlPath}`);

if (shouldExec) {
  const args = ["d1", "execute", "blog-db", `--${target}`, "--file", sqlPath];
  console.log(`\nRunning: wrangler ${args.join(" ")}`);
  await execa("wrangler", args, { stdio: "inherit" });
}
