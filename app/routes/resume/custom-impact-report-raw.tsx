import REPORT_HTML from "./custom-impact-report.html?raw";

export function loader() {
  return new Response(REPORT_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
