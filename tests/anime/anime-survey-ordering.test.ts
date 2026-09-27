import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIME_SURVEY_ORDERING_VERSION,
  applyAnimeSurveyRecognitionOrdering,
  buildAnimeSurveyRecognitionOrder,
} from "../../app/features/anime/anime-survey-ordering.server";
import { getNextUnresolvedSurveyCandidate } from "../../app/features/anime/anime-survey.server";

function row(
  animeId: number,
  position: number,
  collection: number | null,
  score: number | null,
  format: string | null = "TV",
) {
  return {
    animeId,
    existingPosition: position,
    bangumiCollectionTotal: collection,
    bangumiAverageScore: score,
    format,
  };
}

test("ordering v2 ranks existing scope candidates by Bangumi recognition", () => {
  assert.equal(ANIME_SURVEY_ORDERING_VERSION, 2);

  const ranked = buildAnimeSurveyRecognitionOrder([
    row(1, 1, 100, 95),
    row(2, 2, 900, 60),
    row(3, 3, 400, 80),
  ]);

  assert.deepEqual(ranked.map((item) => item.animeId), [2, 3, 1]);
});

test("candidates without Bangumi metrics stay after known metrics and preserve old relative order", () => {
  const ranked = buildAnimeSurveyRecognitionOrder([
    row(1, 1, null, null),
    row(2, 2, 500, 70),
    row(3, 3, null, null),
    row(4, 4, 800, 60),
  ]);

  assert.deepEqual(ranked.map((item) => item.animeId), [4, 2, 1, 3]);
});

type Candidate = {
  animeId: number;
  position: number;
  collection: number | null;
  score: number | null;
  format: string | null;
  decisionStatus?: "WANT" | "NOT_SEEN" | null;
};

function fakeOrderingDb(initial: Candidate[]) {
  const candidates = initial.map((item) => ({ ...item }));

  function boundStatement(sql: string, values: unknown[]) {
    return {
      sql,
      values,
      bind(...nextValues: unknown[]) {
        return boundStatement(sql, nextValues);
      },
      async first<T>() {
        return null as T | null;
      },
      async all<T>() {
        if (
          sql.includes("FROM anime_scope_candidates c")
          && sql.includes("LEFT JOIN anime_bangumi_metrics")
          && sql.includes("c.position AS existing_position")
        ) {
          return {
            results: [...candidates]
              .sort((a, b) => a.position - b.position)
              .map((item) => ({
                anime_id: item.animeId,
                existing_position: item.position,
                collection_total: item.collection,
                bangumi_average_score: item.score,
                format: item.format,
              })) as T[],
          };
        }

        if (
          sql.includes("FROM anime_scope_candidates c")
          && sql.includes("LEFT JOIN anime_user_decisions")
          && sql.includes("ORDER BY c.position ASC")
        ) {
          const limit = Number(values[values.length - 1]);
          const unresolved = [...candidates]
            .filter((item) => !item.decisionStatus)
            .sort((a, b) => a.position - b.position)
            .slice(0, Number.isFinite(limit) ? limit : candidates.length)
            .map((item) => ({
              position: item.position,
              anime_id: item.animeId,
              mal_id: null,
              anilist_id: null,
              bangumi_id: item.animeId,
              title_zh_tw: `動畫 ${item.animeId}`,
              title_native: null,
              title_romaji: null,
              title_english: null,
              year: 2025,
              season: "WINTER",
              format: item.format,
              episodes: 12,
              cover_url: null,
              studio: null,
              popularity: null,
              average_score: item.score,
              bangumi_collection_total: item.collection,
              bangumi_average_score: item.score,
              decision_status: item.decisionStatus ?? null,
              detail_status: null,
            }));
          return { results: unresolved as T[] };
        }
        return { results: [] as T[] };
      },
      async run() {
        if (
          sql.includes("UPDATE anime_scope_candidates")
          && sql.includes("SET position = position + ?")
        ) {
          const offset = Number(values[0]);
          for (const candidate of candidates) candidate.position += offset;
          return { meta: { changes: candidates.length } };
        }

        if (
          sql.includes("UPDATE anime_scope_candidates")
          && sql.includes("SET position = ?")
          && sql.includes("AND anime_id = ?")
        ) {
          const position = Number(values[0]);
          const animeId = Number(values[2]);
          const candidate = candidates.find((item) => item.animeId === animeId);
          if (candidate) candidate.position = position;
          return { meta: { changes: candidate ? 1 : 0 } };
        }

        return { meta: { changes: 0 } };
      },
    };
  }

  const db = {
    prepare(sql: string) {
      return boundStatement(sql, []);
    },
    async batch(statements: Array<ReturnType<typeof boundStatement>>) {
      for (const statement of statements) {
        if (typeof statement?.run === "function") await statement.run();
      }
      return [];
    },
  } as unknown as D1Database;

  return {
    db,
    snapshot() {
      return [...candidates]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({ animeId: item.animeId, position: item.position }));
    },
  };
}

test("existing scope migration rewrites only positions and is idempotent", async () => {
  const fake = fakeOrderingDb([
    { animeId: 101, position: 1, collection: 100, score: 90, format: "TV" },
    { animeId: 202, position: 2, collection: 900, score: 60, format: "ONA" },
    { animeId: 303, position: 3, collection: 400, score: 80, format: "TV" },
  ]);

  const first = await applyAnimeSurveyRecognitionOrdering(fake.db, "TV:2025:WINTER");
  assert.equal(first.candidateCount, 3);
  assert.equal(first.missingMetricCount, 0);
  assert.equal(first.changed, true);
  assert.deepEqual(fake.snapshot(), [
    { animeId: 202, position: 1 },
    { animeId: 303, position: 2 },
    { animeId: 101, position: 3 },
  ]);

  const second = await applyAnimeSurveyRecognitionOrdering(fake.db, "TV:2025:WINTER");
  assert.equal(second.changed, false);
  assert.deepEqual(fake.snapshot(), [
    { animeId: 202, position: 1 },
    { animeId: 303, position: 2 },
    { animeId: 101, position: 3 },
  ]);
});

test("migration keeps the exact candidate membership while reassigning contiguous positions", async () => {
  const fake = fakeOrderingDb([
    { animeId: 11, position: 7, collection: null, score: null, format: "TV" },
    { animeId: 22, position: 12, collection: 1000, score: 50, format: "TV" },
    { animeId: 33, position: 20, collection: null, score: null, format: "ONA" },
  ]);

  const beforeIds = fake.snapshot().map((item) => item.animeId).sort((a, b) => a - b);
  const result = await applyAnimeSurveyRecognitionOrdering(fake.db, "TV:2019:SPRING");
  const after = fake.snapshot();

  assert.equal(result.missingMetricCount, 2);
  assert.deepEqual(after.map((item) => item.position), [1, 2, 3]);
  assert.deepEqual(
    after.map((item) => item.animeId).sort((a, b) => a - b),
    beforeIds,
  );
  assert.deepEqual(after.map((item) => item.animeId), [22, 11, 33]);
});


test("partially answered scope keeps answers and resumes at first unresolved item in migrated order", async () => {
  const fake = fakeOrderingDb([
    { animeId: 1, position: 1, collection: 100, score: 90, format: "TV" },
    { animeId: 2, position: 2, collection: 900, score: 60, format: "TV", decisionStatus: "NOT_SEEN" },
    { animeId: 3, position: 3, collection: 500, score: 80, format: "TV" },
  ]);

  await applyAnimeSurveyRecognitionOrdering(fake.db, "TV:2025:WINTER");

  assert.deepEqual(fake.snapshot(), [
    { animeId: 2, position: 1 },
    { animeId: 3, position: 2 },
    { animeId: 1, position: 3 },
  ]);

  const next = await getNextUnresolvedSurveyCandidate(fake.db, {
    type: "TV_SEASON",
    year: 2025,
    season: "WINTER",
  });

  assert.equal(next?.animeId, 3);
});
