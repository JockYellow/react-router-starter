import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Camera, UploadCloud, UserCircle2, AlertTriangle } from "lucide-react";

import { requireBlogDb } from "../../lib/d1.server";
import { requireBlogImagesBucket } from "../../lib/r2.server";

const MAX_TAGS = 6;

function parseTagsInput(raw: string) {
  const tokens = raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return Array.from(new Set(tokens)).slice(0, MAX_TAGS);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  return raw ? Number(raw) : 0;
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadGiftImage(bucket: R2Bucket, playerId: string, type: string, file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = (ext || "jpg").toLowerCase();
  const key = `gift/${playerId}/${type.toLowerCase()}-${crypto.randomUUID()}.${safeExt}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  return key;
}

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));

  if (!columns.has("age_years")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  }
  if (!columns.has("age_months")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  }
  if (!columns.has("pk_loss_count")) {
    await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_count INTEGER DEFAULT 0").run();
  }
  if (!columns.has("pk_loss_opponents")) {
    await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_opponents INTEGER DEFAULT 0").run();
  }
}

type PlayerRow = {
  id: string;
  name: string;
  age: number;
  age_years: number | null;
  age_months: number | null;
  round_caught: number;
  pk_value: number;
};

type GiftRow = {
  id: string;
  type: "GOOD" | "BAD";
  slogan: string;
  provider_id: string;
};

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensurePlayerColumns(db);

  const playersResult = await db
    .prepare(
      "SELECT id, name, age, age_years, age_months, round_caught, pk_value FROM players ORDER BY created_at DESC"
    )
    .all<PlayerRow>();
  const giftsResult = await db
    .prepare("SELECT id, type, slogan, provider_id FROM gifts ORDER BY created_at DESC")
    .all<GiftRow>();

  const players = playersResult.results ?? [];
  const gifts = giftsResult.results ?? [];
  const goodCount = gifts.filter((gift) => gift.type === "GOOD").length;
  const badCount = gifts.filter((gift) => gift.type === "BAD").length;

  return { players, gifts, goodCount, badCount };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  const bucket = requireBlogImagesBucket(context);
  await ensurePlayerColumns(db);

  const formData = await request.formData();
  const intent = getString(formData, "intent");

  if (intent !== "create_bundle") {
    return null;
  }

  const name = getString(formData, "player_name");
  const ageYears = getNumber(formData, "player_age_years");
  const ageMonths = getNumber(formData, "player_age_months");

  const goodSlogan = getString(formData, "good_slogan");
  const badSlogan = getString(formData, "bad_slogan");

  if (!name || !goodSlogan || !badSlogan) {
    return { error: "請填寫玩家名稱與兩份禮物的描述" };
  }
  if (ageYears <= 0 || ageMonths < 0 || ageMonths > 11) {
    return { error: "請輸入正確的年齡（年/月份）" };
  }

  const existing = await db
    .prepare("SELECT id FROM players WHERE name = ?")
    .bind(name)
    .first<{ id: string }>();
  if (existing) {
    return { error: "這個暱稱已存在，請換一個" };
  }

  const goodTags = parseTagsInput(getString(formData, "good_tags"));
  const badTags = parseTagsInput(getString(formData, "bad_tags"));
  const goodFile = getFile(formData, "good_image");
  const badFile = getFile(formData, "bad_image");

  const playerId = crypto.randomUUID();
  const goodGiftId = crypto.randomUUID();
  const badGiftId = crypto.randomUUID();

  let goodImageKey: string | null = null;
  let badImageKey: string | null = null;

  if (goodFile) {
    goodImageKey = await uploadGiftImage(bucket, playerId, "good", goodFile);
  }
  if (badFile) {
    badImageKey = await uploadGiftImage(bucket, playerId, "bad", badFile);
  }

  await db.batch([
    db
      .prepare(
        "INSERT INTO players (id, name, age, age_years, age_months, round_caught, pk_value, pk_loss_count, pk_loss_opponents) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)"
      )
      .bind(playerId, name, ageYears, ageYears, ageMonths),
    db
      .prepare(
        "INSERT INTO gifts (id, type, provider_id, slogan, tags, image_key, is_locked, is_forced, vote_count, is_revealed) VALUES (?, 'GOOD', ?, ?, ?, ?, 0, 0, 0, 0)"
      )
      .bind(goodGiftId, playerId, goodSlogan, JSON.stringify(goodTags), goodImageKey),
    db
      .prepare(
        "INSERT INTO gifts (id, type, provider_id, slogan, tags, image_key, is_locked, is_forced, vote_count, is_revealed) VALUES (?, 'BAD', ?, ?, ?, ?, 0, 0, 0, 0)"
      )
      .bind(badGiftId, playerId, badSlogan, JSON.stringify(badTags), badImageKey),
  ]);

  return redirect("/gift");
}

export default function GiftPrePage() {
  const { players, goodCount, badCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Pre-Game</p>
            <h1 className="font-[Unbounded,_system-ui,_sans-serif] text-2xl md:text-3xl">
              玩家資料與禮物上傳
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
              玩家 {players.length}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-100">
              好禮 {goodCount}
            </span>
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-100">
              鬧禮 {badCount}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/60">
          每位玩家需要準備一份好禮物與一份鬧禮物，完成後即可進入 R1。
        </p>
      </section>

      {actionData?.error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {actionData.error}
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="space-y-4">
        <input type="hidden" name="intent" value="create_bundle" />
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
              <UserCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">玩家資料</h2>
              <p className="text-xs text-white/50">暱稱與年齡（PK 將由系統產生）</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              name="player_name"
              placeholder="暱稱"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                name="player_age_years"
                placeholder="年"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
                min={1}
                required
              />
              <input
                type="number"
                name="player_age_months"
                placeholder="月"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
                min={0}
                max={11}
                required
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/20 text-fuchsia-200">
                <Camera className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">禮物 A · 好禮物</h2>
                <p className="text-xs text-white/50">拍照或上傳圖片</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <input
                type="file"
                name="good_image"
                accept="image/*"
                capture="environment"
                className="w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-4 py-3 text-xs text-white/70"
              />
              <input
                type="text"
                name="good_slogan"
                placeholder="一句話描述"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
                required
              />
              <input
                type="text"
                name="good_tags"
                placeholder="#Hashtag #Tag"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-200">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">禮物 B · 鬧禮物</h2>
                <p className="text-xs text-white/50">搞怪、無用或地獄梗</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <input
                type="file"
                name="bad_image"
                accept="image/*"
                capture="environment"
                className="w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-4 py-3 text-xs text-white/70"
              />
              <input
                type="text"
                name="bad_slogan"
                placeholder="一句話描述"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
                required
              />
              <input
                type="text"
                name="bad_tags"
                placeholder="#Hashtag #Tag"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/20 px-4 py-3 text-sm font-semibold text-cyan-100"
          disabled={isSubmitting}
        >
          {isSubmitting ? "建立中..." : "建立玩家 + 兩份禮物"}
        </button>
      </Form>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-white/80">已建立玩家</h3>
        {players.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">尚未新增玩家</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm"
              >
                <span className="text-white">{player.name}</span>
                <span className="text-xs text-white/50">
                  年齡 {player.age_years ?? player.age} 年 {player.age_months ?? 0} 月
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
