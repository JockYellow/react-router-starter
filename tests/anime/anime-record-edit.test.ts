import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAnimeRecordEdit,
  sanitizeAnimeLibraryReturnTo,
} from "../../app/features/anime/anime-record-edit";

test("non-seen edits clear seen-only fields", () => {
  const edit = normalizeAnimeRecordEdit({
    status: "WANT",
    detailStatus: "COMPLETE",
    rating: "LOVE",
    tags: ["WANT_REWATCH"],
    note: "old note",
  });

  assert.deepEqual(edit, {
    status: "WANT",
    detailStatus: null,
    rating: null,
    tags: [],
    note: null,
  });
});

test("seen edits normalize optional detail, rating, tags, and note", () => {
  const edit = normalizeAnimeRecordEdit({
    status: "SEEN",
    detailStatus: "COMPLETE",
    rating: "LOVE",
    tags: ["WANT_REWATCH", "BAD", "WANT_REWATCH", "MUSIC_ADDS_A_LOT"],
    note: "  memorable ending  ",
  });

  assert.equal(edit.status, "SEEN");
  assert.equal(edit.detailStatus, "COMPLETE");
  assert.equal(edit.rating, "LOVE");
  assert.deepEqual(edit.tags, ["WANT_REWATCH", "MUSIC_ADDS_A_LOT"]);
  assert.equal(edit.note, "memorable ending");
});

test("seen edits may remain incomplete without forcing a rating", () => {
  const edit = normalizeAnimeRecordEdit({ status: "SEEN", detailStatus: "", rating: "" });
  assert.equal(edit.detailStatus, null);
  assert.equal(edit.rating, null);
});

test("rating still requires viewing detail", () => {
  assert.throws(
    () => normalizeAnimeRecordEdit({ status: "SEEN", detailStatus: "", rating: "RECOMMEND" }),
    /Viewing detail is required before rating/,
  );
});

test("invalid status, detail, and rating are rejected", () => {
  assert.throws(() => normalizeAnimeRecordEdit({ status: "NOPE" }), /primary status/);
  assert.throws(
    () => normalizeAnimeRecordEdit({ status: "SEEN", detailStatus: "NOPE" }),
    /watch detail/,
  );
  assert.throws(
    () => normalizeAnimeRecordEdit({ status: "SEEN", detailStatus: "COMPLETE", rating: "NOPE" }),
    /evaluation/,
  );
});

test("detail return path only accepts library or watchlist listings", () => {
  assert.equal(sanitizeAnimeLibraryReturnTo("/anime/library"), "/anime/library");
  assert.equal(
    sanitizeAnimeLibraryReturnTo("/anime/library?status=SEEN&offset=48"),
    "/anime/library?status=SEEN&offset=48",
  );
  assert.equal(sanitizeAnimeLibraryReturnTo("/anime/watchlist"), "/anime/watchlist");
  assert.equal(
    sanitizeAnimeLibraryReturnTo("/anime/watchlist?q=Frieren&sort=SCORE_DESC"),
    "/anime/watchlist?q=Frieren&sort=SCORE_DESC",
  );
  assert.equal(sanitizeAnimeLibraryReturnTo("https://example.com"), "/anime/library");
  assert.equal(sanitizeAnimeLibraryReturnTo("/anime/library/123"), "/anime/library");
});
