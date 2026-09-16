export type AnimeSurveyCredits = {
  studio: string | null;
  directors: string[];
};

type BangumiRelatedPersonLike = {
  name?: unknown;
  type?: unknown;
  relation?: unknown;
};

function cleanName(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRelation(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Pulls only the two credits useful for the survey decision UI.
 * Bangumi relation text is human-readable and can vary slightly by locale.
 */
export function parseBangumiSurveyCredits(
  people: readonly BangumiRelatedPersonLike[],
  fallbackStudio: string | null = null,
): AnimeSurveyCredits {
  const directors = unique(
    people
      .filter((person) => /(导演|導演|監督)/.test(cleanRelation(person.relation)))
      .map((person) => cleanName(person.name)),
  );

  const studios = unique(
    people
      .filter((person) => /(动画制作|動畫製作|动画制作公司|動畫製作公司|アニメーション制作)/.test(cleanRelation(person.relation)))
      .map((person) => cleanName(person.name)),
  );

  return {
    studio: studios[0] ?? cleanName(fallbackStudio),
    directors,
  };
}
