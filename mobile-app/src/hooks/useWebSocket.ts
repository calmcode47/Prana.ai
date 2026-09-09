/**
 * useWebSocket — PRANA real-time corridor hook
 *
 * Connects to `/ws/{cityId}` on the backend.
 * Usage:
 *   const { lastMessage, isConnected, wsError } = useWebSocket('delhi');
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { connectWebSocket, WsMessage } from '../api/client';

type CityId = 'delhi' | 'ncr' | 'punjab' | 'haryana';

interface UseWebSocketResult {
  lastMessage: WsMessage | null;
  isConnected: boolean;
  wsError: string | null;
  reconnect: () => void;
}

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 2_000;

export function useWebSocket(cityId: CityId): UseWebSocketResult {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const open = useCallback(() => {
    if (!isMounted.current) return;

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = connectWebSocket(
      cityId,
      (msg) => {
        if (isMounted.current) {
          setLastMessage(msg);
          setWsError(null);
        }
      },
      (_event) => {
        if (isMounted.current) {
          setWsError('Real-time connection error — retrying…');
          setIsConnected(false);
        }
      },
    );

    ws.onopen = () => {
      if (isMounted.current) {
        setIsConnected(true);
        setWsError(null);
        reconnectAttempt.current = 0;
      }
    };

    const prevOnClose = ws.onclose;
    ws.onclose = (event) => {
      if (prevOnClose) {
        try {
          prevOnClose.call(ws, event);
        } catch {}
      }
      if (!isMounted.current) return;
      setIsConnected(false);
      const attempt = Math.min(reconnectAttempt.current, 10);
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * 2 ** attempt,
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttempt.current = Math.min(reconnectAttempt.current + 1, 15);
      reconnectTimer.current = setTimeout(open, delay);
    };

    wsRef.current = ws;
  }, [cityId]);

  useEffect(() => {
    isMounted.current = true;
    open();

    return () => {
      isMounted.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [open]);

  const reconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttempt.current = 0;
    open();
  }, [open]);

  return { lastMessage, isConnected, wsError, reconnect };
}
