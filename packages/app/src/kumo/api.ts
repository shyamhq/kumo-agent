import { AuthRequest, exchangeCodeAsync, fetchDiscoveryAsync } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import { queryClient } from "@/data/query-client";
import { kumo } from "./config";
import { type Computer, computerSchema } from "./plan";

// The Kumo session can mint a worker token for every computer its holder reaches, so it lives in
// the Keychain, not AsyncStorage.
const TOKEN_KEY = "kumo.session";

export const signedInQuery = {
  queryKey: ["kumo", "signed-in"],
  queryFn: async () => (await SecureStore.getItemAsync(TOKEN_KEY)) !== null,
  dataShape: "value" as const,
  staleTimeMs: 60_000,
};

const exchangeSchema = z.object({ token: z.string() });
const refusalSchema = z.object({ message: z.string() });

/** Kumo answered, and said no. `message` is the sentence Kumo wrote for the person. */
export class KumoRefusedError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class KumoSignedOutError extends Error {
  constructor() {
    super("Signed out of Kumo");
  }
}

async function refusal(response: Response): Promise<KumoRefusedError> {
  const parsed = refusalSchema.safeParse(await response.json().catch(() => null));
  const message = parsed.success ? parsed.data.message : `Kumo answered ${response.status}`;
  return new KumoRefusedError(response.status, message);
}

/** Ends the session here. The person's computer list goes with it: nothing may read it after. */
async function forgetSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  queryClient.removeQueries({ queryKey: computersQuery.queryKey });
  await queryClient.invalidateQueries({ queryKey: signedInQuery.queryKey });
}

/**
 * Clerk runs the sign-in in the system's browser sheet (PKCE, every Clerk method, the consent
 * screen), and Kumo trades the app's OAuth token for its own session. The sheet is ephemeral, so
 * it never finishes as whoever Safari happens to remember. A dismissed sheet is not an error.
 */
export async function signIn(): Promise<void> {
  const discovery = await fetchDiscoveryAsync(kumo.issuer);
  const request = new AuthRequest({
    clientId: kumo.clientId,
    redirectUri: kumo.redirectUri,
    scopes: ["openid", "email", "profile"],
  });
  const result = await request.promptAsync(discovery, { preferEphemeralSession: true });
  if (result.type === "error") throw result.error ?? new Error("Sign-in failed");
  if (result.type !== "success") return;
  // `AuthRequest` makes one for every prompt (`usePKCE` is on by default).
  const verifier = request.codeVerifier;
  if (!verifier) throw new Error("Sign-in started without a PKCE verifier");

  const tokens = await exchangeCodeAsync(
    {
      clientId: kumo.clientId,
      code: result.params.code,
      redirectUri: kumo.redirectUri,
      extraParams: { code_verifier: verifier },
    },
    discovery,
  );
  const response = await fetch(`${kumo.api}/auth/phone/exchange`, {
    method: "POST",
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!response.ok) throw await refusal(response);
  const { token } = exchangeSchema.parse(await response.json());
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await queryClient.invalidateQueries({ queryKey: ["kumo"] });
}

/**
 * Ends this phone's Kumo session: here at once, then on Kumo when it answers. A Kumo that can't be
 * reached lets the session lapse on its own within a week.
 */
export async function signOut(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  await forgetSession();
  if (!token) return;
  void fetch(`${kumo.api}/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/** A control-plane call as the signed-in person. A 401 means the session is over: sign in again. */
export async function kumoFetch(
  path: string,
  { method = "GET" }: { method?: "GET" | "POST" } = {},
): Promise<Response> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new KumoSignedOutError();
  const response = await fetch(`${kumo.api}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    await forgetSession();
    throw new KumoSignedOutError();
  }
  if (!response.ok) throw await refusal(response);
  return response;
}

const listSchema = z.object({ boxes: z.array(computerSchema) });

/** Every computer the signed-in person owns or was given. */
export const computersQuery = {
  queryKey: ["kumo", "computers"],
  queryFn: async (): Promise<Computer[]> =>
    listSchema.parse(await (await kumoFetch("/boxes")).json()).boxes,
  dataShape: "list" as const,
  staleTimeMs: 30_000,
};

/** Anyone a computer is shared with may start it; its owner's credit pays. */
export async function startComputer(id: string): Promise<void> {
  await kumoFetch(`/boxes/${id}/start`, { method: "POST" });
}
