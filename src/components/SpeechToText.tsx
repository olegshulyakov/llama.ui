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

export type SpeechRecordCallback = (text: string) => void;

const userLanguage =
  navigator.languages && navigator.languages.length > 0
    ? navigator.languages[0]
    : navigator.language
      ? navigator.language
      : 'en-US';

const BrowserSpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export const IS_SPEECH_RECOGNITION_SUPPORTED =
  (window.SpeechRecognition || window.webkitSpeechRecognition) !== undefined;

interface SpeechToTextProps {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onRecord?: SpeechRecordCallback;
}

interface SpeechToTextState {
  isRecording: boolean;
  transcript: string;
  startRecording: () => void;
  stopRecording: () => void;
}

const useSpeechToText = ({
  lang = userLanguage,
  continuous = true,
  interimResults = true,
  onRecord,
}: SpeechToTextProps = {}): SpeechToTextState => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const cleanupPreviousRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!BrowserSpeechRecognition) {
      console.error('Speech Recognition not supported');
      return;
    }

    cleanupPreviousRecognition();

    const recognition = new BrowserSpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      if (!event?.results) return;

      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = Array.from(result)
          .map((alt) => alt.transcript)
          .join(' ');

        if (result.isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setTranscript(final + interim);
      onRecord?.(final + interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error: ', event.error, event.message);
      setIsRecording(false);
    };

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return cleanupPreviousRecognition;
  }, [lang, continuous, interimResults, onRecord, cleanupPreviousRecognition]);

  const startRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !isRecording) {
      setTranscript('');
      try {
        recognition.start();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && isRecording) {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
  };
};

const SpeechToText = forwardRef<
  SpeechToTextState,
  SpeechToTextProps & { children: (props: SpeechToTextState) => ReactNode }
>(({ children, lang, continuous, interimResults, onRecord }, ref) => {
  const speechToText = useSpeechToText({
    lang,
    continuous,
    interimResults,
    onRecord,
  });

  useImperativeHandle(ref, () => speechToText, [speechToText]);

  return <Fragment>{children(speechToText)}</Fragment>;
});

export default SpeechToText;
