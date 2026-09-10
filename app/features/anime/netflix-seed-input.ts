import {
  NETFLIX_REVIEW_STATUSES,
  type ReviewedNetflixSeedRow,
} from "./netflix-seed";

const MAX_SEED_ROWS = 500;

export class NetflixSeedValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "NetflixSeedValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function optionalNonNegativeInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0 || !Number.isInteger(numberValue)) return null;
  return numberValue;
}

function optionalPositiveInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0 || !Number.isInteger(numberValue)) return null;
  return numberValue;
}

export function parseReviewedNetflixSeed(input: unknown): ReviewedNetflixSeedRow[] {
  const rawRows = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.rows)
      ? input.rows
      : null;

  if (!rawRows) {
    throw new NetflixSeedValidationError(["Seed payload must be an array or an object with a rows array."]);
  }
  if (rawRows.length > MAX_SEED_ROWS) {
    throw new NetflixSeedValidationError([`Seed payload exceeds ${MAX_SEED_ROWS} rows.`]);
  }

  const issues: string[] = [];
  const rows: ReviewedNetflixSeedRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 1;
    if (!isRecord(rawRow)) {
      issues.push(`Row ${rowNumber}: expected an object.`);
      return;
    }

    const title = optionalString(rawRow.title);
    const reviewStatus = optionalString(rawRow.reviewStatus);
    if (!title) issues.push(`Row ${rowNumber}: title is required.`);
    if (!reviewStatus) issues.push(`Row ${rowNumber}: reviewStatus is required.`);
    if (
      reviewStatus &&
      !(NETFLIX_REVIEW_STATUSES as readonly string[]).includes(reviewStatus)
    ) {
      issues.push(`Row ${rowNumber}: unsupported reviewStatus '${reviewStatus}'.`);
    }
    if (!title || !reviewStatus) return;

    rows.push({
      title,
      reviewStatus,
      category: optionalString(rawRow.category),
      format: optionalString(rawRow.format),
      viewingRecordCount: optionalNonNegativeInteger(rawRow.viewingRecordCount),
      distinctTitleCount: optionalNonNegativeInteger(rawRow.distinctTitleCount),
      firstWatchedAt: optionalString(rawRow.firstWatchedAt),
      lastWatchedAt: optionalString(rawRow.lastWatchedAt),
      evidence: optionalString(rawRow.evidence),
      verificationStatus: optionalString(rawRow.verificationStatus),
      verificationUrl: optionalString(rawRow.verificationUrl),
      sourceRowNumber: optionalPositiveInteger(rawRow.sourceRowNumber),
    });
  });

  if (issues.length) throw new NetflixSeedValidationError(issues);
  return rows;
}
