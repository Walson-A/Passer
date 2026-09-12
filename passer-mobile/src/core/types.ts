/**
 * Shapes shared with the Passer desktop app. The contract is documented in
 * `docs/desktop/api.md`; keep both sides in sync.
 */

/** Decoded `passer://pair` link, exactly as the desktop QR code carries it. */
export type PairingPayload = {
  version: number;
  name: string;
  host: string | null;
  ip: string | null;
  port: number;
  token: string;
  id: string | null;
};

/** Which of the two advertised addresses answered. */
export type AddressKind = 'host' | 'ip';

/** A paired PC as persisted on the phone. Its token lives in secure storage, never here. */
export type PairedPc = {
  /** Local key: the desktop's stable id when the QR code carried one. */
  key: string;
  id: string | null;
  name: string;
  host: string | null;
  ip: string | null;
  port: number;
  pairedAt: number;
  /** The address that answered last, tried first on the next connection. */
  preferredAddress: AddressKind;
};

/**
 * `GET /ping`. `name`, `mdns` and `id` are missing on desktops released before
 * each PC got a unique network name.
 */
export type PingInfo = {
  app: 'passer';
  version: string;
  host: string;
  name?: string;
  mdns?: string;
  id?: string;
};

/** A verified way to reach a paired PC right now. */
export type Endpoint = {
  baseUrl: string;
  address: AddressKind;
  ping: PingInfo;
};
