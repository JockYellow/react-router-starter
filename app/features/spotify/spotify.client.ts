export type SpotifyImage = {
  url: string;
  height?: number | null;
  width?: number | null;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  images?: SpotifyImage[];
  followers?: { total: number };
  genres?: string[];
  popularity?: number;
  external_urls?: { spotify?: string };
};

export type LatestReleaseInfo = {
  name: string | null;
  date: string | null;
  precision: string | null;
};

export async function fetchStoredArtistIds(datasetKey: string) {
  const res = await fetch(`/api/spotify/ids?dataset=${encodeURIComponent(datasetKey)}`);
  if (!res.ok) {
    throw new Error(`Failed to load ids: ${res.status}`);
  }
  const data = (await res.json()) as { artistIds?: string[] };
  return data.artistIds ?? [];
}

export async function fetchArtistsByIds(ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  const res = await fetch(`/api/spotify/artists?${params.toString()}`);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Artists fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { artists?: SpotifyArtist[] };
  return data.artists ?? [];
}

export async function fetchArtistPreview(artistId: string): Promise<string | null> {
  const res = await fetch(`/api/spotify/preview/${artistId}`);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Preview fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { previewUrl?: string | null };
  return data.previewUrl ?? null;
}

export async function fetchLatestRelease(artistId: string): Promise<LatestReleaseInfo | null> {
  const res = await fetch(`/api/spotify/latest-release/${artistId}`);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Latest release fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    releaseName?: string | null;
    releaseDate?: string | null;
    releasePrecision?: string | null;
  };
  return {
    name: data.releaseName ?? null,
    date: data.releaseDate ?? null,
    precision: data.releasePrecision ?? null,
  };
}
