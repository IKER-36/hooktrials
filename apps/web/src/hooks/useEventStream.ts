import { useEffect, useRef, useState } from 'react';
import { API_ORIGIN } from '../lib/api';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting';

/**
 * Subscribes to the SSE attempt stream of an endpoint. Calls `onAttempt`
 * (coalesced) whenever new attempts arrive so the caller can refresh data.
 */
export function useEventStream(endpointId: string | null, onAttempt: () => void): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const callback = useRef(onAttempt);
  callback.current = onAttempt;

  useEffect(() => {
    if (!endpointId) {
      setStatus('idle');
      return;
    }
    setStatus('connecting');
    const stream = new EventSource(`${API_ORIGIN}/v1/endpoints/${endpointId}/stream`, {
      withCredentials: true,
    });
    let refreshTimer: number | undefined;

    stream.addEventListener('ready', () => setStatus('live'));
    stream.onopen = () => setStatus('live');
    stream.onerror = () => setStatus('reconnecting');
    stream.addEventListener('attempt', () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => callback.current(), 200);
    });

    return () => {
      window.clearTimeout(refreshTimer);
      stream.close();
    };
  }, [endpointId]);

  return status;
}
