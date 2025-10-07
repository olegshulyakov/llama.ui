// useAvailableVoices.ts

import { useEffect, useState, useCallback } from 'react';

export type VoiceType = 'kokoro' | 'browser';

export type UnifiedVoice =
  | {
      type: 'browser';
      id: string;
      label: string;
      raw: SpeechSynthesisVoice;
    }
  | {
      type: 'kokoro';
      id: string;
      label: string;
      raw: string;
    };

export function getKokoroApiUrl(serverIp: string, serverPort: string): string {
  if (!serverIp || !serverPort) return '';
  return `http://${serverIp}:${serverPort}/v1/audio/voices`;
}

interface UseAvailableVoicesResult {
  voices: UnifiedVoice[];
  refreshVoices: () => void;
  isLoading: boolean;
}

export function useAvailableVoices(
  serverIp?: string,
  serverPort?: string
): UseAvailableVoicesResult {
  const [voices, setVoices] = useState<UnifiedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Always start with browser voices
      const synthVoices = window.speechSynthesis.getVoices();
      const browserVoices: UnifiedVoice[] = synthVoices.map((v) => ({
        type: 'browser',
        id: `browser-${v.name}-${v.lang}`,
        label: `🌐 ${v.name} (${v.lang})`,
        raw: v,
      }));

      // Only try to fetch Kokoro voices if server settings are provided
      const kokoroVoices: UnifiedVoice[] = [];
      const apiUrl = getKokoroApiUrl(serverIp || '', serverPort || '');

      if (apiUrl) {
        try {
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            kokoroVoices.push(
              ...data.voices.map((v: string) => ({
                type: 'kokoro',
                id: `kokoro-${v}`,
                label: `🎵 Kokoro: ${v}`,
                raw: v,
              }))
            );
          }
        } catch (err) {
          console.warn('Could not load Kokoro voices:', err);
        }
      }

      setVoices([...browserVoices, ...kokoroVoices]);
    } catch (err) {
      console.error('Error loading voices:', err);
      setVoices([]); // Reset to empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [serverIp, serverPort]);

  useEffect(() => {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }, [loadVoices, refreshTrigger]);

  const refreshVoices = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return { voices, refreshVoices, isLoading };
}
