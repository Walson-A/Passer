/**
 * Hands a scanned or pasted pairing link to the pairing screen without putting
 * it in the route, where the token would sit in navigation state.
 */
let pendingLink: string | null = null;

export function setPendingLink(link: string): void {
  pendingLink = link;
}

/** Returns the link once; later reads get `null`. */
export function takePendingLink(): string | null {
  const link = pendingLink;
  pendingLink = null;
  return link;
}
