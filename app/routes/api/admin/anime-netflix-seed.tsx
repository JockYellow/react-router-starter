import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  getCsrfToken,
  requireCsrf,
} from "../../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../../lib/d1.server";
import {
  NetflixSeedValidationError,
  parseReviewedNetflixSeed,
} from "../../../features/anime/netflix-seed-input";
import {
  getReviewedNetflixSeedQueueSummary,
  NETFLIX_SEED_QUEUE_STATUSES,
  processReviewedNetflixSeedQueue,
  retryReviewedNetflixSeedQueue,
  stageReviewedNetflixSeedRows,
  type NetflixSeedQueueStatus,
} from "../../../features/anime/netflix-seed-queue.server";

function jsonError(message: string, status = 400, details?: unknown) {
  return Response.json({ ok: false, error: message, details }, { status });
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const csrf = await getCsrfToken(request, context);
  const db = requireBlogDb(context);
  const summary = await getReviewedNetflixSeedQueueSummary(db);
  return Response.json(
    { ok: true, csrfToken: csrf.token, summary },
    { headers: { "Set-Cookie": csrf.cookie } },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  const db = requireBlogDb(context);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON request body.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonError("Expected a JSON object request body.");
  }

  const payload = body as Record<string, unknown>;
  const intent = typeof payload.intent === "string" ? payload.intent : "";

  try {
    if (intent === "stage") {
      const rows = parseReviewedNetflixSeed(payload);
      const staged = await stageReviewedNetflixSeedRows(db, rows);
      const summary = await getReviewedNetflixSeedQueueSummary(db);
      return Response.json({ ok: true, staged, summary });
    }

    if (intent === "resolve") {
      const rawLimit = Number(payload.limit ?? 5);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 10)) : 5;
      const processed = await processReviewedNetflixSeedQueue(db, { limit });
      const summary = await getReviewedNetflixSeedQueueSummary(db);
      return Response.json({ ok: true, processed, summary });
    }

    if (intent === "retry") {
      const requested = Array.isArray(payload.statuses) ? payload.statuses : ["ERROR"];
      const statuses = requested.filter(
        (value): value is NetflixSeedQueueStatus =>
          typeof value === "string" &&
          (NETFLIX_SEED_QUEUE_STATUSES as readonly string[]).includes(value),
      );
      const reset = await retryReviewedNetflixSeedQueue(db, statuses);
      const summary = await getReviewedNetflixSeedQueueSummary(db);
      return Response.json({ ok: true, reset, summary });
    }
  } catch (error) {
    if (error instanceof NetflixSeedValidationError) {
      return jsonError("Invalid Netflix seed payload.", 400, error.issues);
    }
    console.error("Anime Netflix seed admin action failed", error);
    return jsonError("Netflix seed operation failed.", 500);
  }

  return jsonError("Unknown intent. Use stage, resolve, or retry.");
}
