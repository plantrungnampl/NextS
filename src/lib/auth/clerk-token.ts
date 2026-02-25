import "server-only";

type ClerkGetToken = (options?: { template?: string }) => Promise<string | null>;

export async function getClerkTokenForSupabase(
  getToken: ClerkGetToken,
): Promise<string | null> {
  return getToken();
}
