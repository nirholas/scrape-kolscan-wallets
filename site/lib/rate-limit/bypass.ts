// Bypass list for internal services and testing

/**
 * Internal API keys that bypass rate limiting.
 * These should be set as environment variables for security.
 */
function getBypassKeys(): Set<string> {
  const keys = new Set<string>();

  if (process.env.INTERNAL_API_KEY) {
    keys.add(process.env.INTERNAL_API_KEY);
  }

  if (process.env.TEST_API_KEY) {
    keys.add(process.env.TEST_API_KEY);
  }

  // Support for multiple internal keys (comma-separated)
  if (process.env.INTERNAL_API_KEYS) {
    const keyList = process.env.INTERNAL_API_KEYS.split(",");
    for (const key of keyList) {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        keys.add(trimmedKey);
      }
    }
  }

  return keys;
}

let cachedBypassKeys: Set<string> | null = null;

/**
 * Check if an API key should bypass rate limiting.
 * This is used for internal services and testing.
 */
export function shouldBypassRateLimit(apiKey: string | null): boolean {
  if (!apiKey) return false;

  // Lazy-load and cache bypass keys
  if (!cachedBypassKeys) {
    cachedBypassKeys = getBypassKeys();
  }

  return cachedBypassKeys.has(apiKey);
}

/**
 * Clear the cached bypass keys (useful for testing or hot-reloading)
 */
export function clearBypassCache(): void {
  cachedBypassKeys = null;
}
