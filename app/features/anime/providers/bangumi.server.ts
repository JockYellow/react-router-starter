import { fetchJsonWithTimeout } from "./provider-http.server";

const BANGUMI_ENDPOINT = "https://api.bgm.tv/v0/search/subjects";
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = "JockYellow/AnimeMemory (https://github.com/JockYellow/react-router-starter)";

export type BangumiAnimeCandidate = {
  id: number;
  name: string;
  nameCn: string | null;
  date: string | null;
  platform: string | null;
};

type BangumiRawSubject = {
  id?: number | null;
  name?: string | null;
  name_cn?: string | null;
  date?: string | null;
  platform?: string | null;
};

type BangumiSearchResponse = {
  data?: Array<BangumiRawSubject | null> | null;
  total?: number | null;
};

export async function searchBangumiAnime(
  keyword: string,
  options: { limit?: number; offset?: number } = {},
): Promise<BangumiAnimeCandidate[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 10), 20));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const url = new URL(BANGUMI_ENDPOINT);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const payload = await fetchJsonWithTimeout<BangumiSearchResponse>(
    "Bangumi",
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        keyword: trimmed,
        sort: "match",
        filter: {
          type: [2],
          nsfw: false,
        },
      }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  return (payload.data ?? [])
    .filter((subject): subject is BangumiRawSubject => Boolean(subject?.id && subject?.name))
    .map((subject) => ({
      id: subject.id as number,
      name: (subject.name as string).trim(),
      nameCn: subject.name_cn?.trim() || null,
      date: subject.date ?? null,
      platform: subject.platform ?? null,
    }));
}
