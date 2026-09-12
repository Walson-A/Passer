import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { isSamePc, locate, ping } from '@/core/endpoint';
import { PasserError } from '@/core/errors';
import type { Endpoint } from '@/core/types';
import { readToken } from '@/platform/secrets';

import { usePairings } from './pairings';

/** A cheap unauthenticated `/ping` keeps the status honest without hammering the PC. */
const HEARTBEAT_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 2_500;
/** Retries while the PC is unreachable: quick at first, then easy on the battery. */
const RETRY_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

export type Connection =
  | { status: 'none' }
  | { status: 'searching' }
  | { status: 'online'; endpoint: Endpoint; token: string }
  | { status: 'offline'; reason: PasserError; lastSeen: number | null }
  | { status: 'unauthorized' };

type ConnectionValue = {
  connection: Connection;
  /** Reconnects now, from "Try again" or after the network changed. */
  retry: () => void;
  /** An authenticated request came back 401: stop retrying until the PC is paired again. */
  reportUnauthorized: () => void;
};

const ConnectionContext = createContext<ConnectionValue | null>(null);

function asPasserError(error: unknown): PasserError {
  if (error instanceof PasserError) return error;
  return new PasserError('unreachable', error instanceof Error ? error.message : 'Unknown failure');
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { pc, rememberAddress } = usePairings();
  const [connection, setConnection] = useState<Connection>({ status: 'none' });
  const [attempt, setAttempt] = useState(0);
  const lastSeen = useRef<number | null>(null);
  /** The pairing that was rejected; cleared by pairing again, which changes `pairedAt`. */
  const rejectedPairing = useRef<string | null>(null);
  const remember = useRef(rememberAddress);
  remember.current = rememberAddress;

  useEffect(() => {
    if (!pc) {
      setConnection({ status: 'none' });
      return;
    }
    if (rejectedPairing.current === `${pc.key}:${pc.pairedAt}`) {
      setConnection({ status: 'unauthorized' });
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;

    const pause = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      controller?.abort();
    };

    const heartbeat = async (endpoint: Endpoint) => {
      controller = new AbortController();
      try {
        const info = await ping(endpoint.baseUrl, HEARTBEAT_TIMEOUT_MS, controller.signal);
        if (disposed) return;
        if (!isSamePc(pc, info)) {
          void connect();
          return;
        }
        lastSeen.current = Date.now();
        timer = setTimeout(() => void heartbeat(endpoint), HEARTBEAT_MS);
      } catch (error) {
        if (disposed || asPasserError(error).kind === 'cancelled') return;
        void connect();
      }
    };

    const connect = async () => {
      pause();
      controller = new AbortController();
      const { signal } = controller;
      try {
        const [endpoint, token] = await Promise.all([locate(pc, signal), readToken(pc.key)]);
        if (disposed || signal.aborted) return;
        if (!token) {
          setConnection({ status: 'unauthorized' });
          return;
        }
        failures = 0;
        lastSeen.current = Date.now();
        if (endpoint.address !== pc.preferredAddress) remember.current(pc.key, endpoint.address);
        setConnection((current) =>
          current.status === 'online' && current.endpoint.baseUrl === endpoint.baseUrl
            ? current
            : { status: 'online', endpoint, token },
        );
        timer = setTimeout(() => void heartbeat(endpoint), HEARTBEAT_MS);
      } catch (error) {
        const failure = asPasserError(error);
        if (disposed || failure.kind === 'cancelled') return;
        setConnection({ status: 'offline', reason: failure, lastSeen: lastSeen.current });
        timer = setTimeout(() => void connect(), RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
      }
    };

    setConnection((current) => (current.status === 'online' ? current : { status: 'searching' }));
    if (AppState.currentState === 'active') void connect();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void connect();
      else pause();
    });

    return () => {
      disposed = true;
      pause();
      subscription.remove();
    };
  }, [pc, attempt]);

  const retry = () => setAttempt((value) => value + 1);

  const reportUnauthorized = () => {
    if (!pc) return;
    rejectedPairing.current = `${pc.key}:${pc.pairedAt}`;
    setConnection({ status: 'unauthorized' });
    setAttempt((value) => value + 1);
  };

  return (
    <ConnectionContext.Provider value={{ connection, retry, reportUnauthorized }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionValue {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error('useConnection must be used inside ConnectionProvider');
  return value;
}
