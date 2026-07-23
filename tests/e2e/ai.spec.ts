import { expect, test } from "playwright/test";

const MOCK_ANALYSIS = [
  "event: delta",
  'data: {"delta":"一句話結論\\n具備 Customer Success 與導入經驗。"}',
  "",
  "event: usage",
  'data: {"inputTokens":2200,"outputTokens":120,"cachedTokens":1536,"cacheWriteTokens":0,"remaining":4}',
  "",
  "event: done",
  'data: {"done":true}',
  "",
].join("\n");

test("company-fit renders streamed content and cached-token usage", async ({ page }) => {
  await page.route("**/api/ai/company-fit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-store" },
      body: MOCK_ANALYSIS,
    });
  });

  await page.goto("/resume/company-fit");
  await page.getByLabel("公司名稱 *").fill("測試公司");
  await page.getByLabel(/職缺名稱/).fill("Customer Success Manager");
  await page.getByLabel(/職缺內容/).fill("負責 SaaS 導入、客戶健康度與續約。");
  await page.getByRole("button", { name: /開始分析/ }).click();

  await expect(page.getByText("具備 Customer Success 與導入經驗。")).toBeVisible();
  await expect(page.getByText("1536")).toBeVisible();
  await expect(page.getByRole("button", { name: /重新產生/ })).toBeVisible();
});

test("resume bot answers canonical FAQ locally and fits the viewport", async ({ page }) => {
  let aiRequests = 0;
  await page.route("**/api/ai/chat", async (route) => {
    aiRequests += 1;
    await route.abort();
  });

  await page.goto("/resume");
  await page.getByRole("button", { name: "開啟履歷問答 Bot" }).click();
  await page.getByRole("button", { name: "有哪些作品或專案可以看？" }).click();

  const panel = page.getByRole("dialog", { name: "履歷問答 Bot" });
  await expect(panel.getByText(/履歷列出的作品與專案包括/)).toBeVisible();
  expect(aiRequests).toBe(0);

  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
});
