/**
 * Returns an error response if the request Origin doesn't match the app's
 * trusted origins, protecting against cross-site request forgery.
 * Returns null if the origin is acceptable.
 */
export function checkOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // same-origin requests from non-browser clients are fine

  const trusted = (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ||
    process.env.NEXT_PUBLIC_URL ||
    "http://localhost:3000"
  )
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""));

  if (!trusted.includes(origin.replace(/\/$/, ""))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
