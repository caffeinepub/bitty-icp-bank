import { createActorWithConfig } from "../config";

let _cachedActor: unknown = null;

export function setCachedActor(actor: unknown) {
  _cachedActor = actor;
}

export async function waitForActor(timeoutMs = 8000): Promise<unknown> {
  if (_cachedActor) return _cachedActor;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (_cachedActor) return _cachedActor;
    await new Promise((r) => setTimeout(r, 100));
  }

  // Last resort: create anonymous actor
  const actor = await createActorWithConfig();
  return actor;
}
