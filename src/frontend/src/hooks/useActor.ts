import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";

// Module-level ref so mutations can always access the latest actor
let _currentActor: backendInterface | null = null;
export function getCurrentActor() {
  return _currentActor;
}

// Wait up to 5 seconds for the actor to become available
export async function waitForActor(): Promise<backendInterface> {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (_currentActor) return _currentActor;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Backend not ready. Please try again in a moment.");
}

export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      const isAuthenticated = !!identity;

      if (!isAuthenticated) {
        // Return anonymous actor if not authenticated
        return await createActorWithConfig();
      }

      const actorOptions = {
        agentOptions: {
          identity,
        },
      };

      const actor = await createActorWithConfig(actorOptions);
      return actor;
    },
    // Only refetch when identity changes
    staleTime: Number.POSITIVE_INFINITY,
    // This will cause the actor to be recreated when the identity changes
    enabled: true,
  });

  const actor = actorQuery.data || null;
  // Keep the module-level ref in sync
  if (actor) {
    _currentActor = actor;
  }

  // When the actor changes, invalidate dependent queries
  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return !query.queryKey.includes(ACTOR_QUERY_KEY);
        },
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          return !query.queryKey.includes(ACTOR_QUERY_KEY);
        },
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor,
    isFetching: actorQuery.isFetching,
  };
}
