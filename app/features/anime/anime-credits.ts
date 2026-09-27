export type AnimeSurveyCredits = {
  studio: string | null;
  studioDisplay: string | null;
  studioPersonId: number | null;
  directors: string[];
};

type BangumiRelatedPersonLike = {
  id?: unknown;
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

  const studioPeople = people
    .filter((person) => /(动画制作|動畫製作|动画制作公司|動畫製作公司|アニメーション制作)/.test(cleanRelation(person.relation)))
    .map((person) => ({
      id: typeof person.id === "number" && Number.isInteger(person.id) && person.id > 0 ? person.id : null,
      name: cleanName(person.name),
    }))
    .filter((person): person is { id: number | null; name: string } => Boolean(person.name));

  const studio = unique(studioPeople.map((person) => person.name))[0] ?? cleanName(fallbackStudio);
  const studioPersonId = studio
    ? studioPeople.find((person) => person.name === studio)?.id ?? null
    : null;

  return {
    studio,
    studioDisplay: studio,
    studioPersonId,
    directors,
  };
}
