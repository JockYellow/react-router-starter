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
};

export type SpotifyProfile = {
  id: string;
  display_name: string | null;
  images?: SpotifyImage[];
};

export type FollowedArtistsProgress = {
  count: number;
  total: number | null;
};

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Spotify API error: ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function fetchSpotifyProfile(token: string): Promise<SpotifyProfile> {
  return spotifyFetch<SpotifyProfile>(`${SPOTIFY_API_BASE}/me`, token);
}

export async function fetchAllFollowedArtists(
  token: string,
  onProgress?: (progress: FollowedArtistsProgress) => void,
): Promise<{ ids: string[]; total: number } > {
  let url: string | null = `${SPOTIFY_API_BASE}/me/following?type=artist&limit=50`;
  const ids: string[] = [];
  let total = 0;

  while (url) {
    const data = await spotifyFetch<{
      artists: { items: SpotifyArtist[]; next: string | null; total: number };
    }>(url, token);

    const items = data.artists.items ?? [];
    if (!total && data.artists.total) total = data.artists.total;
    for (const artist of items) {
      ids.push(artist.id);
    }
    onProgress?.({ count: ids.length, total: total || null });
    url = data.artists.next;
  }

  return { ids, total: total || ids.length };
}

export async function fetchArtistsByIds(token: string, ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  const data = await spotifyFetch<{ artists: SpotifyArtist[] }>(
    `${SPOTIFY_API_BASE}/artists?${params.toString()}`,
    token,
  );
  return data.artists ?? [];
}

export async function fetchArtistPreview(token: string, artistId: string): Promise<string | null> {
  const data = await spotifyFetch<{ tracks: { preview_url: string | null }[] }>(
    `${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks?market=US`,
    token,
  );
  const preview = data.tracks.find((track) => track.preview_url)?.preview_url ?? null;
  return preview;
}
