/**
 * Bench stand-in for the Keychain (see `web-bench.ts`): tokens live in memory
 * for the life of the page, and the bench seeds the paired PC's token.
 */
const tokens = new Map<string, string>();

export function seedToken(pcKey: string, token: string): void {
  tokens.set(pcKey, token);
}

export async function saveToken(pcKey: string, token: string): Promise<void> {
  tokens.set(pcKey, token);
}

export async function readToken(pcKey: string): Promise<string | null> {
  return tokens.get(pcKey) ?? null;
}

export async function deleteToken(pcKey: string): Promise<void> {
  tokens.delete(pcKey);
}
