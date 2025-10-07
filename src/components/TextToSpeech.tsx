// TextToSpeech.tsx

import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  // useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { UnifiedVoice } from './useAvailableVoices';

interface TextToSpeechProps {
  text: string;
  selectedVoice: UnifiedVoice | null;
  pitch?: number;
  rate?: number;
  volume?: number;
  serverConfig?: TTSServerConfig;
}

interface TextToSpeechState {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
}

interface TTSServerConfig {
  serverIp: string;
  serverPort: string;
}

const useTextToSpeech = ({
  text,
  selectedVoice,
  pitch = 1,
  rate = 1,
  volume = 1,
  serverConfig,
}: TextToSpeechProps & {
  serverConfig?: TTSServerConfig;
}): TextToSpeechState => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async () => {
    if (!selectedVoice) return;

    if (selectedVoice.type === 'kokoro') {
      if (!serverConfig?.serverIp || !serverConfig?.serverPort) {
        console.error('TTS server configuration is missing');
        return;
      }

      try {
        const response = await fetch(
          `http://${serverConfig.serverIp}:${serverConfig.serverPort}/v1/audio/speech`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'kokoro',
              input: text,
              voice: selectedVoice.raw, // ✅ string
              response_format: 'mp3',
              speed: rate,
            }),
          }
        );

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.volume = volume;
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch (err) {
        console.error('Kokoro TTS failed:', err);
      }
    } else if (selectedVoice.type === 'browser') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice.raw; // ✅ SpeechSynthesisVoice
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = volume;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      speechSynthesis.speak(utterance);
    }
  }, [
    text,
    selectedVoice,
    pitch,
    rate,
    volume,
    serverConfig?.serverIp,
    serverConfig?.serverPort,
  ]);

  const stop = useCallback(() => {
    setIsPlaying(false);

    // Stop browser speech synthesis if active
    if (selectedVoice?.type === 'browser') {
      speechSynthesis.cancel();
    }

    // Stop and cleanup Kokoro audio if active
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, [selectedVoice?.type]);

  return { isPlaying, play, stop };
};

const TextToSpeech = forwardRef<
  TextToSpeechState,
  TextToSpeechProps & { children: (props: TextToSpeechState) => ReactNode }
>(({ children, ...props }, ref) => {
  const { isPlaying, play, stop } = useTextToSpeech(props);

  useImperativeHandle(ref, () => ({ isPlaying, play, stop }), [
    isPlaying,
    play,
    stop,
  ]);

  return <Fragment>{children({ isPlaying, play, stop })}</Fragment>;
});

export default TextToSpeech;
