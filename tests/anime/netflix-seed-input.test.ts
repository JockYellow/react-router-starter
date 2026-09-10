import assert from "node:assert/strict";
import test from "node:test";

import {
  NetflixSeedValidationError,
  parseReviewedNetflixSeed,
} from "../../app/features/anime/netflix-seed-input";

test("Netflix seed parser accepts array or rows envelope", () => {
  const direct = parseReviewedNetflixSeed([
    { title: "Example", reviewStatus: "看完", viewingRecordCount: "3" },
  ]);
  const wrapped = parseReviewedNetflixSeed({
    rows: [{ title: "Example 2", reviewStatus: "沒看", sourceRowNumber: 7 }],
  });

  assert.equal(direct[0]?.title, "Example");
  assert.equal(direct[0]?.viewingRecordCount, 3);
  assert.equal(wrapped[0]?.sourceRowNumber, 7);
});

test("Netflix seed parser rejects missing and unknown statuses", () => {
  assert.throws(
    () => parseReviewedNetflixSeed([{ title: "Example", reviewStatus: "未知" }]),
    (error) =>
      error instanceof NetflixSeedValidationError &&
      error.issues.some((issue) => issue.includes("unsupported reviewStatus")),
  );

  assert.throws(
    () => parseReviewedNetflixSeed([{ reviewStatus: "看完" }]),
    (error) =>
      error instanceof NetflixSeedValidationError &&
      error.issues.some((issue) => issue.includes("title is required")),
  );
});

test("Netflix seed parser limits bulk payload size", () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    title: `Title ${index}`,
    reviewStatus: "看完",
  }));
  assert.throws(() => parseReviewedNetflixSeed(rows), NetflixSeedValidationError);
});
