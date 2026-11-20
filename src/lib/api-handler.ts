import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonError } from "@/lib/utils";
import IdempotencyKey from "@/models/IdempotencyKey";

type AuthContext = { userId: string };

const MAX_KEY_LENGTH = 100;

/**
 * Replay-safe writes: when a mutating request carries an `Idempotency-Key`, the first run's
 * response is stored and returned for any retry. The offline outbox relies on this so a
 * request that reached the server but whose response was lost is never applied twice.
 */
async function runIdempotent(
  request: Request,
  userId: string,
  run: () => Promise<Response>
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > MAX_KEY_LENGTH || request.method === "GET") return run();

  try {
    await IdempotencyKey.create({ userId, key, status: "pending" });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const prior = await IdempotencyKey.findOne({ userId, key }).lean();
    if (prior?.status === "done") {
      return Response.json(prior.responseBody, { status: prior.responseStatus ?? 200 });
    }
    return jsonError("Request already in progress", 409);
  }

  let response: Response;
  try {
    response = await run();
  } catch (err) {
    await IdempotencyKey.deleteOne({ userId, key });
    throw err;
  }

  if (response.status >= 500) {
    await IdempotencyKey.deleteOne({ userId, key }); // let the client retry
    return response;
  }
  const body = await response.clone().json().catch(() => null);
  await IdempotencyKey.updateOne(
    { userId, key },
    { status: "done", responseStatus: response.status, responseBody: body }
  );
  return response;
}

export function withAuth(
  handler: (request: Request, ctx: AuthContext) => Promise<Response>,
  fallback = "Request failed"
) {
  return async (request: Request, routeCtx?: unknown) => {
    try {
      const userId = requireAuthUserId(request);
      await connectToDatabase();
      return await runIdempotent(request, userId, () =>
        (handler as (r: Request, c: AuthContext, rc?: unknown) => Promise<Response>)(
          request,
          { userId },
          routeCtx
        )
      );
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
      return jsonError(err instanceof Error ? err.message : fallback, 500);
    }
  };
}
