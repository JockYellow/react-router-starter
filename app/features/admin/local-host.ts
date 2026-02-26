const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isPrivateIpv4(hostname: string) {
  if (!IPV4_PATTERN.test(hostname)) return false;

  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function isLocalHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
}
