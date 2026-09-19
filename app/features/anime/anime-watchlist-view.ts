export type AnimeWatchlistView = "QUEUE" | "ALL";

export function resolveAnimeWatchlistView(params: URLSearchParams): AnimeWatchlistView {
  if (
    params.get("view") === "all"
    || Boolean(params.get("q")?.trim())
    || params.has("sort")
    || params.has("offset")
  ) {
    return "ALL";
  }
  return "QUEUE";
}
