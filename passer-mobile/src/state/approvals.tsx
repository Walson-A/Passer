import { useEffect, useState, type ReactNode } from 'react';

import { ApprovalPrompt, type QueuedRequest } from '@/components/approval-prompt';

import { PasserCore, type ApprovalRequest } from '../../modules/passer-core';

const core = PasserCore.module;

/**
 * Requests other devices send this phone's user, one at a time, over any screen.
 * Each keeps the moment it arrived: the core times a request from when it asked, so one
 * waiting behind another must not restart its countdown when it comes forward.
 */
export function ApprovalsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedRequest[]>([]);

  useEffect(() => {
    if (!core) return;
    const subscriptions = [
      core.addListener('onApprovalRequest', (request: ApprovalRequest) =>
        setQueue((list) => [...list, { ...request, arrivedAt: Date.now() }]),
      ),
      core.addListener('onApprovalClosed', ({ id }) => setQueue((list) => list.filter((r) => r.id !== id))),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const answer = (request: QueuedRequest, allow: boolean) => {
    core?.answerApproval(request.id, allow);
    setQueue((list) => list.filter((r) => r.id !== request.id));
  };

  return (
    <>
      {children}
      <ApprovalPrompt request={queue[0] ?? null} waiting={Math.max(0, queue.length - 1)} onAnswer={answer} />
    </>
  );
}
