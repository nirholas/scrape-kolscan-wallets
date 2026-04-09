import { NextRequest, NextResponse } from "next/server";
import {
  checkApiRateLimit,
  addRateLimitHeaders,
  createRateLimitResponse,
  getTierFromApiKey,
  trackRequest,
} from "@/lib/rate-limit/index";
import { isValidEvmAddress } from "@/lib/proxy/types";

type EvmHandler = (
  request: NextRequest,
  params: Record<string, string>
) => Promise<NextResponse>;

interface EvmRouteOptions {
  /**
   * Whether to validate the `address` path param as a valid EVM address.
   * Defaults to true when an `address` param is present.
   */
  validateAddress?: boolean;
}

/**
 * Wraps an EVM proxy handler with:
 *  - EVM address validation (for routes with an `address` param)
 *  - Per-user rate limiting (API key or IP)
 *  - Rate limit response headers
 */
export function createEvmRoute(handler: EvmHandler, options: EvmRouteOptions = {}) {
  return async function GET(
    request: NextRequest,
    { params: paramsPromise }: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> {
    const params = await paramsPromise;
    const userIp = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      null;

    // Validate address when present and validation is not explicitly disabled
    const shouldValidate = options.validateAddress !== false && "address" in params;
    if (shouldValidate && !isValidEvmAddress(params.address)) {
      return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
    }

    const tier = await getTierFromApiKey(apiKey);
    const result = await checkApiRateLimit(request, apiKey, userIp, tier);

    if (!result.success || !result.quotaAllowed) {
      await trackRequest(apiKey || userIp, request.nextUrl.pathname, true);
      return createRateLimitResponse(result);
    }

    await trackRequest(apiKey || userIp, request.nextUrl.pathname, false);

    try {
      const response = await handler(request, params);
      addRateLimitHeaders(response, result);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
