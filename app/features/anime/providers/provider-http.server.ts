export class AnimeProviderError extends Error {
  provider: string;
  status: number | null;

  constructor(provider: string, message: string, status: number | null = null) {
    super(message);
    this.name = "AnimeProviderError";
    this.provider = provider;
    this.status = status;
  }
}

export type ProviderRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, at - Date.now());
}

function retryDelayMs(
  attempt: number,
  options: Required<ProviderRetryOptions>,
  retryAfterHeader?: string | null,
) {
  const retryAfter = parseRetryAfterMs(retryAfterHeader ?? null);
  if (retryAfter != null) return Math.min(options.maxDelayMs, retryAfter);
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
  const jitter = options.jitterMs > 0 ? Math.random() * options.jitterMs : 0;
  return Math.min(options.maxDelayMs, Math.round(exponential + jitter));
}

export async function fetchJsonWithTimeout<T>(
  provider: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
  retryOptions: ProviderRetryOptions = {},
): Promise<T> {
  const retry: Required<ProviderRetryOptions> = {
    maxRetries: Math.max(0, Math.min(Math.trunc(retryOptions.maxRetries ?? 2), 4)),
    baseDelayMs: Math.max(0, Math.trunc(retryOptions.baseDelayMs ?? 500)),
    maxDelayMs: Math.max(0, Math.trunc(retryOptions.maxDelayMs ?? 8_000)),
    jitterMs: Math.max(0, Math.trunc(retryOptions.jitterMs ?? 250)),
  };

  for (let attempt = 0; attempt <= retry.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const canRetry = RETRYABLE_STATUSES.has(response.status) && attempt < retry.maxRetries;
        if (canRetry) {
          await sleep(retryDelayMs(attempt, retry, response.headers.get("Retry-After")));
          continue;
        }

        throw new AnimeProviderError(
          provider,
          `${provider} request failed (${response.status})${body ? `: ${body.slice(0, 500)}` : ""}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AnimeProviderError) throw error;

      const isAbort = error instanceof Error && error.name === "AbortError";
      if (attempt < retry.maxRetries) {
        await sleep(retryDelayMs(attempt, retry));
        continue;
      }

      if (isAbort) {
        throw new AnimeProviderError(provider, `${provider} request timed out after ${timeoutMs}ms`);
      }

      throw new AnimeProviderError(
        provider,
        error instanceof Error ? error.message : `${provider} request failed`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AnimeProviderError(provider, `${provider} request failed after retries`);
}
