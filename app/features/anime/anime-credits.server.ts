import { parseBangumiSurveyCredits, type AnimeSurveyCredits } from "./anime-credits";
import { ensureAnimeSchema } from "./anime.schema.server";
import { fetchJsonWithTimeout } from "./providers/provider-http.server";

const BANGUMI_API_BASE = "https://api.bgm.tv/v0/subjects";
const USER_AGENT = "JockYellow/AnimeMemory (https://github.com/JockYellow/react-router-starter)";

type RelatedPerson = {
  id?: number;
  name?: string;
  type?: number;
  relation?: string;
};

export async function getAnimeSurveyCredits(
  db: D1Database,
  animeId: number,
): Promise<AnimeSurveyCredits> {
  await ensureAnimeSchema(db);

  const row = await db
    .prepare("SELECT bangumi_id, studio FROM anime_items WHERE anime_id = ?")
    .bind(animeId)
    .first<{ bangumi_id: number | null; studio: string | null }>();

  if (!row) return { studio: null, directors: [] };
  if (!row.bangumi_id) return { studio: row.studio, directors: [] };

  try {
    const people = await fetchJsonWithTimeout<RelatedPerson[]>(
      "Bangumi",
      `${BANGUMI_API_BASE}/${row.bangumi_id}/persons`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      },
      8_000,
      { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 1_500, jitterMs: 150 },
    );

    return parseBangumiSurveyCredits(Array.isArray(people) ? people : [], row.studio);
  } catch {
    // Credits are optional decision hints. Provider failure must not block survey use.
    return { studio: row.studio, directors: [] };
  }
}
