export const toDateInputValue = (value: Date) => value.toISOString().slice(0, 10);
export const toKktixDate = (value: string) => value.replace(/-/g, "/");

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
};

export const serializeParams = (params: Record<string, string>) =>
  JSON.stringify(
    Object.keys(params)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {}),
  );

export const formatRangeLabel = (startAt: string, endAt: string) => {
  if (!startAt && !endAt) return "";
  return `${startAt || "起"} ~ ${endAt || "迄"}`;
};
