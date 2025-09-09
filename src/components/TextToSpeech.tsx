import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// Define language popularity order (you can customize this)
const popularLanguages = [
  'en',
  'zh',
  'hi',
  'es',
  'fr',
  'ru',
  'pt',
  'de',
  'ja',
  'ko',
  'it',
  'ar',
];

export const IS_SPEECH_SYNTHESIS_SUPPORTED = !!window.speechSynthesis;
export const getSpeechSynthesisVoices = () =>
  speechSynthesis
    ?.getVoices()
    .filter((voice) => voice.localService)
    .sort((a, b) => {
      // Default voice first
      if (a.default !== b.default) return a.default ? -1 : 1;

      // Popular languages on top
      const aRank = popularLanguages.indexOf(a.lang.substring(0, 2));
      const bRank = popularLanguages.indexOf(b.lang.substring(0, 2));
      if (aRank !== bRank) {
        const aEffectiveRank = aRank === -1 ? Infinity : aRank;
        const bEffectiveRank = bRank === -1 ? Infinity : bRank;
        return aEffectiveRank - bEffectiveRank;
      }

      // Sort by language and name (alphabetically)
      return a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
    }) || [];
export function getSpeechSynthesisVoiceByName(name: string) {
  return getSpeechSynthesisVoices().find(
    (voice) => `${voice.name} (${voice.lang})` === name
  );
}

interface TextToSpeechProps {
  text: string;
  voice?: SpeechSynthesisVoice;
  pitch?: number;
  rate?: number;
  volume?: number;
}

interface TextToSpeechState {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
}

const useTextToSpeech = ({
  text,
  voice = getSpeechSynthesisVoices()[0],
  pitch = 1,
  rate = 1,
  volume = 1,
}: TextToSpeechProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!IS_SPEECH_SYNTHESIS_SUPPORTED) {
      console.warn('Speech synthesis not supported');
      return;
    }
    if (!text) {
      console.warn('No text provided');
      return;
    }

    // Clean up previous utterance
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);

    utterance.voice = voice;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    // Event handlers
    utterance.onstart = () => {
      setIsPlaying(true);
    };

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error: ', event.error);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;

    return () => {
      speechSynthesis.cancel();
      if (utteranceRef.current === utterance) {
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current = null;
      }
    };
  }, [pitch, rate, text, voice, volume]);

  const play = useCallback(() => {
    if (!IS_SPEECH_SYNTHESIS_SUPPORTED) {
      console.warn('Speech synthesis not supported');
      return;
    }
    speechSynthesis.cancel();

    if (utteranceRef.current) {
      try {
        speechSynthesis.speak(utteranceRef.current);
      } catch (error) {
        console.error('Speech synthesis error:', error);
        setIsPlaying(false);
      }
    }
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    play,
    stop,
  };
};

const TextToSpeech = forwardRef<
  TextToSpeechState,
  TextToSpeechProps & { children: (props: TextToSpeechState) => ReactNode }
>(({ children, text, voice, pitch, rate, volume }, ref) => {
  const { isPlaying, play, stop } = useTextToSpeech({
    text,
    voice,
    pitch,
    rate,
    volume,
  });

  useImperativeHandle(
    ref,
    () => ({
      isPlaying,
      play,
      stop,
    }),
    [isPlaying, play, stop]
  );

  return <Fragment>{children({ isPlaying, play, stop })}</Fragment>;
});

export default TextToSpeech;
