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

export async function fetchJsonWithTimeout<T>(
  provider: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AnimeProviderError(
        provider,
        `${provider} request failed (${response.status})${body ? `: ${body.slice(0, 500)}` : ""}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AnimeProviderError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
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
