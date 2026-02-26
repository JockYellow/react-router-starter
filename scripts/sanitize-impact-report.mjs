import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";

const SCALE_FACTOR = 1.35;
const FEEDBACK_URL = "https://example.com/feedback";

const repoRoot = process.cwd();
const routeHtmlPath = path.join(repoRoot, "app/routes/resume/custom-impact-report.html");
const routeContentPath = path.join(repoRoot, "app/routes/resume/custom-impact-report.content.ts");
const routePath = path.join(repoRoot, "app/routes/resume/custom-impact-report.tsx");
const sourcePath = routeHtmlPath;
const outputHtmlPath = routeHtmlPath;

const textReplacements = [
  ["未來市股份有限公司", "軟體研發公司 A"],
  ["COMMEET", "費用管理平台 X"],
  ["GA", "部門 A"],
  ["Social Media & Content", "部門 B"],
  ["Social Media &amp; Content", "部門 B"],
  ["Globalization", "部門 C"],
  ["Product Art", "部門 D"],
  ["HR", "部門 E"],
  ["IP&Compliance", "部門 E"],
  ["IP&amp;Compliance", "部門 E"],
  ["6. 費用管理平台 X 數位企業卡交易分析", "6. 數位企業卡交易分析"],
  ["go.commeet.co", "example.com"],
];

const colorReplacements = [
  [/#1E1B16/gi, "#425563"],
  [/#EF7A00/gi, "#6B5CA0"],
  [/#ef7a00/gi, "#6B5CA0"],
  [/#ea580c/gi, "#4C3D81"],
  [/#007bb6/gi, "#B9923E"],
  [/#F4F7F9/gi, "#F6F5F2"],
  [/#E2E8F0/gi, "#EEECE6"],
  [/#84C1FF/gi, "#DAD3FA"],
  [/#93c5fd/gi, "#BFB4EE"],
  [/#3b82f6/gi, "#7A6AAE"],
  [/#1d4ed8/gi, "#4C3D81"],
  [/#dbeafe/gi, "#EDE8FE"],
  [/#f5a623/gi, "#D9B45A"],
  [/#ffc833/gi, "#E8C872"],
  [/#9ca3af/gi, "#C8C1D8"],
  [/rgba\(239,\s*122,\s*0,\s*0\.1\)/gi, "rgba(107, 92, 160, 0.12)"],
  [/rgba\(245,\s*166,\s*35,\s*0\.1\)/gi, "rgba(185, 146, 62, 0.12)"],
  [/rgba\(66,\s*85,\s*99,\s*0\.9\)/gi, "rgba(30, 27, 22, 0.9)"],
  [/#505,104/gi, "#425563"],
];

const zendeskMap = new Map([
  ["https://go-commeet.zendesk.com/hc/zh-tw/articles/9616558079119", "https://example.com/docs/budget"],
  ["https://go-commeet.zendesk.com/hc/zh-tw/articles/8167805121167", "https://example.com/docs/custom-fields"],
  ["https://go-commeet.zendesk.com/hc/zh-tw/articles/12787855635087", "https://example.com/docs/policy"],
  ["https://go-commeet.zendesk.com/hc/zh-tw/articles/8487660348431-2-13-%E5%9F%BA%E6%9C%AC%E8%A8%AD%E5%AE%9A-%E7%AB%99%E5%8F%B0%E8%A8%AD%E5%AE%9A#01K0BZQXXQ6G1EPSGWVS07QXB9", "https://example.com/docs/duplicate-check"],
  ["https://go-commeet.zendesk.com/hc/zh-tw/articles/9351043705743-C-16-%E7%8E%89%E5%B1%B1%E9%8A%80%E8%A1%8C-%E6%95%B8%E4%BD%8D%E4%BC%81%E6%A5%AD%E5%8D%A1%E4%BD%BF%E7%94%A8%E5%A0%B4%E6%99%AF", "https://example.com/docs/card-usage"],
]);

const DATE_PATTERN = /\b\d{4}-\d{2}(?:-\d{2})?\b/g;
const PERCENT_PATTERN = /\d[\d,]*(?:\.\d+)?\s*[％%]/g;
const ORDINAL_PATTERN = /(^|\s)(\d+)(?=\.\s)/g;
const FRACTION_PATTERN = /(?<![\w-])(\d[\d,]*(?:\.\d+)?)\s*\/\s*(\d[\d,]*(?:\.\d+)?)(?![\w-])/g;
const NUMBER_PATTERN = /(?<![\w-])\d[\d,]*(?:\.\d+)?(?![\w-])/g;
const NON_SCALING_REPORTDATA_KEYS = new Set([
  "section_id",
  "chart_id",
  "type",
  "yAxisID",
  "xAxisID",
  "stack",
  "position",
  "format",
  "labels",
  "backgroundColor",
  "borderColor",
]);

function applyStringReplacements(input) {
  let output = input;
  for (const [from, to] of textReplacements) {
    output = output.split(from).join(to);
  }
  for (const [from, to] of colorReplacements) {
    output = output.replace(from, to);
  }
  return output;
}

function isRangeOverlapping(ranges, start, end) {
  return ranges.some((range) => start < range.end && end > range.start);
}

function collectRanges(input, pattern, captureGroup = 0) {
  const ranges = [];
  for (const match of input.matchAll(pattern)) {
    const wholeStart = match.index ?? 0;
    if (captureGroup > 0) {
      const groupText = match[captureGroup] ?? "";
      if (!groupText) continue;
      const innerOffset = match[0].lastIndexOf(groupText);
      if (innerOffset < 0) continue;
      const start = wholeStart + innerOffset;
      ranges.push({ start, end: start + groupText.length });
      continue;
    }
    const text = match[0] ?? "";
    ranges.push({ start: wholeStart, end: wholeStart + text.length });
  }
  return ranges;
}

function scaleRawNumber(rawValue) {
  const normalized = rawValue.replace(/,/g, "");
  const numericValue = Number(normalized);
  if (Number.isNaN(numericValue)) return rawValue;

  const decimalPlaces = rawValue.includes(".") ? rawValue.split(".")[1].length : 0;
  const scaledValue = decimalPlaces > 0
    ? Number((numericValue * SCALE_FACTOR).toFixed(decimalPlaces))
    : Math.round(numericValue * SCALE_FACTOR);

  const useGrouping = rawValue.includes(",") || Math.abs(scaledValue) >= 1000;
  return scaledValue.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping,
  });
}

function scaleNumbersInText(input) {
  if (!/\d/.test(input)) return input;

  const protectedRanges = [
    ...collectRanges(input, DATE_PATTERN),
    ...collectRanges(input, PERCENT_PATTERN),
    ...collectRanges(input, ORDINAL_PATTERN, 2),
  ];
  const transformedRanges = [];

  let output = input.replace(FRACTION_PATTERN, (fullMatch, left, right, offset) => {
    const start = offset;
    const end = start + fullMatch.length;
    if (isRangeOverlapping(protectedRanges, start, end)) return fullMatch;
    transformedRanges.push({ start, end });
    return `${scaleRawNumber(left)}/${scaleRawNumber(right)}`;
  });

  output = output.replace(NUMBER_PATTERN, (match, offset) => {
    const start = offset;
    const end = start + match.length;
    if (
      isRangeOverlapping(protectedRanges, start, end)
      || isRangeOverlapping(transformedRanges, start, end)
    ) {
      return match;
    }
    return scaleRawNumber(match);
  });

  return output;
}

function scaleChartNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  if (Number.isInteger(value)) return Math.round(value * SCALE_FACTOR);
  const raw = String(value);
  const decimalPlaces = raw.includes(".") ? raw.split(".")[1].length : 1;
  return Number((value * SCALE_FACTOR).toFixed(decimalPlaces));
}

function shouldScaleReportDataString(parentKey, value) {
  if (!/\d/.test(value)) return false;
  if (NON_SCALING_REPORTDATA_KEYS.has(parentKey)) return false;
  const trimmed = value.trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return false;
  if (/^(?:rgba?|hsla?)\(/i.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return true;
}

function isPercentDataset(chartConfig, dataset) {
  const yFormat = chartConfig?.options?.scales?.y?.ticks?.format;
  const y1Format = chartConfig?.options?.scales?.y1?.ticks?.format;
  if (yFormat === "percentage" || y1Format === "percentage") return true;

  const label = typeof dataset?.label === "string" ? dataset.label : "";
  const percentLabel = /率|比例|%|％/.test(label);
  if (!percentLabel) return false;

  if (!Array.isArray(dataset?.data)) return false;
  const numericValues = dataset.data.filter((item) => typeof item === "number" && !Number.isNaN(item));
  if (numericValues.length === 0) return false;
  return numericValues.every((item) => item >= 0 && item <= 100);
}

function sanitizeReportData(reportData) {
  const walk = (node, parentKey = "") => {
    if (typeof node === "string") {
      const replaced = applyStringReplacements(node);
      if (!shouldScaleReportDataString(parentKey, replaced)) return replaced;
      return scaleNumbersInText(replaced);
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, parentKey));
    if (node && typeof node === "object") {
      const result = {};
      for (const [key, value] of Object.entries(node)) {
        result[key] = walk(value, key);
      }
      return result;
    }
    return node;
  };

  const cloned = walk(reportData);
  for (const section of Object.values(cloned)) {
    const components = Array.isArray(section?.components) ? section.components : [];
    for (const component of components) {
      const charts = [];
      if (component?.type === "chart" && component?.chart_config) charts.push(component.chart_config);
      if (component?.type === "dual_chart_block" && Array.isArray(component?.charts)) {
        for (const chartItem of component.charts) {
          if (chartItem?.chart_config) charts.push(chartItem.chart_config);
        }
      }

      for (const chartConfig of charts) {
        const datasets = Array.isArray(chartConfig?.data?.datasets) ? chartConfig.data.datasets : [];
        for (const dataset of datasets) {
          if (!Array.isArray(dataset?.data)) continue;
          if (isPercentDataset(chartConfig, dataset)) continue;
          dataset.data = dataset.data.map((value) => scaleChartNumber(value));
        }
      }
    }
  }

  return cloned;
}

function sanitizeLinksAndLogo($) {
  $("a[href]").each((_, element) => {
    const node = $(element);
    const href = node.attr("href");
    if (!href) return;

    if (zendeskMap.has(href)) {
      node.attr("href", zendeskMap.get(href));
      return;
    }
    if (href.includes("go-commeet.zendesk.com")) {
      node.attr("href", "https://example.com/docs");
      return;
    }
    if (href.includes("docs.google.com/forms")) {
      node.attr("href", FEEDBACK_URL);
    }
  });

  $("img[src]").each((_, element) => {
    const node = $(element);
    const src = node.attr("src");
    if (!src) return;

    if (src.includes("api.qrserver.com/v1/create-qr-code")) {
      try {
        const url = new URL(src);
        url.searchParams.set("data", FEEDBACK_URL);
        node.attr("src", url.toString());
      } catch {
        node.attr("src", `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(FEEDBACK_URL)}`);
      }
      node.attr("alt", "回饋連結 QR Code");
      return;
    }

    if (src.includes("logo_commeet") || /logo/i.test(node.attr("alt") ?? "")) {
      node.replaceWith(
        `<span class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-corporate-main text-white text-xs font-bold shadow-soft" aria-label="費用管理平台 X">FX</span>`,
      );
    }
  });
}

function scaleVisibleText($) {
  const skipTags = new Set(["script", "style", "noscript", "code", "pre"]);
  const attrTargets = ["title", "aria-label", "aria-description", "alt"];

  const walk = (node, skip = false) => {
    const tagName = typeof node.name === "string" ? node.name.toLowerCase() : "";
    const isElement = node.type === "tag" || node.type === "script" || node.type === "style";
    const shouldSkip = skip || (tagName ? skipTags.has(tagName) : false);

    if (node.type === "text" && !shouldSkip && typeof node.data === "string") {
      node.data = scaleNumbersInText(node.data);
    }

    if (isElement && !shouldSkip) {
      const element = $(node);
      for (const attrName of attrTargets) {
        const attrValue = element.attr(attrName);
        if (!attrValue) continue;
        element.attr(attrName, scaleNumbersInText(applyStringReplacements(attrValue)));
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child, shouldSkip);
      }
    }
  };

  $.root()
    .contents()
    .each((_, node) => walk(node, false));
}

function rewriteReportDataBlock(html) {
  const reportDataPattern = /(const reportData = )(\{[\s\S]*?\})(;\s*\n\s*function renderSingleChart)/;
  const match = html.match(reportDataPattern);
  if (!match) {
    throw new Error("Cannot locate `reportData` block in report HTML.");
  }
  const reportData = JSON.parse(match[2]);
  const sanitizedReportData = sanitizeReportData(reportData);
  const serialized = JSON.stringify(sanitizedReportData);
  return html.replace(reportDataPattern, `$1${serialized}$3`);
}

function generateRouteFiles(html) {
  const contentSource = `export const REPORT_HTML = ${JSON.stringify(html)};
`;
  const routeSource = `import { REPORT_HTML } from "./custom-impact-report.content";

export function loader() {
  return new Response(REPORT_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
`;
  fs.writeFileSync(routeHtmlPath, html);
  fs.writeFileSync(routeContentPath, contentSource);
  fs.writeFileSync(routePath, routeSource);
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const reportDataOnly = process.argv.includes("--reportdata-only");
  const normalizeOnly = process.argv.includes("--normalize-only");
  let html = fs.readFileSync(sourcePath, "utf8");
  if (normalizeOnly) {
    html = applyStringReplacements(html);
    const $ = load(html, { decodeEntities: false });
    sanitizeLinksAndLogo($);

    const finalHtml = $.html();
    fs.writeFileSync(outputHtmlPath, finalHtml);
    generateRouteFiles(finalHtml);

    process.stdout.write(`Sanitized report generated (normalize only):
- ${path.relative(repoRoot, outputHtmlPath)}
- ${path.relative(repoRoot, routeHtmlPath)}
- ${path.relative(repoRoot, routeContentPath)}
- ${path.relative(repoRoot, routePath)}
`);
    return;
  }

  if (reportDataOnly) {
    html = applyStringReplacements(html);
    html = rewriteReportDataBlock(html);

    const $ = load(html, { decodeEntities: false });
    sanitizeLinksAndLogo($);

    const finalHtml = $.html();
    fs.writeFileSync(outputHtmlPath, finalHtml);
    generateRouteFiles(finalHtml);

    process.stdout.write(`Sanitized report generated (reportData only):
- ${path.relative(repoRoot, outputHtmlPath)}
- ${path.relative(repoRoot, routeHtmlPath)}
- ${path.relative(repoRoot, routeContentPath)}
- ${path.relative(repoRoot, routePath)}
`);
    return;
  }

  html = applyStringReplacements(html);

  html = html.replace(/main:\s*'#[^']+'/, "main: '#425563'");
  html = html.replace(/accent:\s*'#[^']+'/, "accent: '#6B5CA0'");
  html = html.replace(/bg:\s*'#[^']+'/, "bg: '#F6F5F2'");
  html = html.replace(/light:\s*'#[^']+'/, "light: '#EEECE6'");
  html = html.replace(/info:\s*'#[^']+'/, "info: '#B9923E'");

  html = rewriteReportDataBlock(html);

  const $ = load(html, { decodeEntities: false });
  sanitizeLinksAndLogo($);
  scaleVisibleText($);

  const finalHtml = $.html();
  fs.writeFileSync(outputHtmlPath, finalHtml);
  generateRouteFiles(finalHtml);

  process.stdout.write(`Sanitized report generated:
- ${path.relative(repoRoot, outputHtmlPath)}
- ${path.relative(repoRoot, routeHtmlPath)}
- ${path.relative(repoRoot, routeContentPath)}
- ${path.relative(repoRoot, routePath)}
`);
}

main();
