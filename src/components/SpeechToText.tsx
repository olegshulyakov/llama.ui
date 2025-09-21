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

const SpeechRecognition =
  typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition || window.webkitSpeechRecognition;

export const IS_SPEECH_RECOGNITION_SUPPORTED = !!SpeechRecognition;

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
  lang,
  continuous = true,
  interimResults = true,
  onRecord,
}: SpeechToTextProps): SpeechToTextState => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedManuallyRef = useRef<boolean>(false);
  const onRecordRef = useRef<SpeechRecordCallback | undefined>(onRecord);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    onRecordRef.current = onRecord;
  }, [onRecord]);

  useEffect(() => {
    if (!IS_SPEECH_RECOGNITION_SUPPORTED) {
      console.error('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition!();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang =
      lang || navigator.languages?.[0] || navigator.language || 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!event?.results) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const { isFinal, length } = result;
        if (length <= 0) continue;
        const { transcript, confidence } = result[0];
        const fullTranscript = [finalTranscriptRef.current, transcript].join(
          ' '
        );
        setTranscript(fullTranscript);
        onRecordRef.current?.(fullTranscript);
        if (isFinal && confidence > 0) {
          finalTranscriptRef.current += transcript;
        }
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
      // Automatically restart if not stopped manually
      if (continuous && !stoppedManuallyRef.current) {
        try {
          recognition.start();
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (!recognitionRef.current) return;

      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onstart = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    };
  }, [lang, continuous, interimResults]);

  const startRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !isRecording) {
      setTranscript('');
      finalTranscriptRef.current = '';
      stoppedManuallyRef.current = false;
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
      stoppedManuallyRef.current = true;
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
