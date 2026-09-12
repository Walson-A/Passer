import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { AddressKind, Endpoint, PairedPc, PairingPayload } from '@/core/types';
import { deleteToken, saveToken } from '@/platform/secrets';
import { shareWithExtensions } from '@/platform/shared-state';
import { storage } from '@/platform/storage';

type PairingsValue = {
  ready: boolean;
  /** The PC Passer talks to. Phase 1 uses one PC at a time; the list is kept for multi-PC. */
  pc: PairedPc | null;
  pcs: PairedPc[];
  /** Stores a pairing whose endpoint `locate()` has already verified. */
  savePairing: (payload: PairingPayload, endpoint: Endpoint) => Promise<PairedPc>;
  /** Removes the pairing and wipes its token. */
  forget: (pc: PairedPc) => Promise<void>;
  rememberAddress: (pcKey: string, address: AddressKind) => void;
};

const PairingsContext = createContext<PairingsValue | null>(null);

function keyFor(payload: PairingPayload): string {
  if (payload.id) return payload.id;
  return `${payload.name}-${payload.host ?? payload.ip}`.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

export function PairingsProvider({ children }: { children: ReactNode }) {
  const [pcs, setPcs] = useState<PairedPc[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void storage.loadPcs().then((stored) => {
      if (!active) return;
      setPcs(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void storage.savePcs(pcs);
    shareWithExtensions({ pcs });
  }, [pcs, ready]);

  const savePairing = async (payload: PairingPayload, endpoint: Endpoint): Promise<PairedPc> => {
    const key = keyFor(payload);
    // The secret is stored before anything refers to it.
    await saveToken(key, payload.token);
    const pc: PairedPc = {
      key,
      id: payload.id ?? endpoint.ping.id ?? null,
      name: endpoint.ping.name ?? endpoint.ping.host ?? payload.name,
      host: payload.host,
      ip: payload.ip,
      port: payload.port,
      pairedAt: Date.now(),
      preferredAddress: endpoint.address,
    };
    setPcs((current) => [pc, ...current.filter((item) => item.key !== key)]);
    return pc;
  };

  const forget = async (pc: PairedPc): Promise<void> => {
    await deleteToken(pc.key);
    setPcs((current) => current.filter((item) => item.key !== pc.key));
  };

  const rememberAddress = (pcKey: string, address: AddressKind) =>
    setPcs((current) =>
      current.map((item) =>
        item.key === pcKey && item.preferredAddress !== address ? { ...item, preferredAddress: address } : item,
      ),
    );

  return (
    <PairingsContext.Provider
      value={{ ready, pc: pcs[0] ?? null, pcs, savePairing, forget, rememberAddress }}
    >
      {children}
    </PairingsContext.Provider>
  );
}

export function usePairings(): PairingsValue {
  const value = useContext(PairingsContext);
  if (!value) throw new Error('usePairings must be used inside PairingsProvider');
  return value;
}
