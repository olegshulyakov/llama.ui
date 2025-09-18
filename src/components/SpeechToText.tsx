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

  useEffect(() => {
    onRecordRef.current = onRecord;
  }, [onRecord]);

  const cleanRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.onresult = null;
    recognitionRef.current.onend = null;
    recognitionRef.current.onerror = null;
    recognitionRef.current.onstart = null;
    recognitionRef.current.stop();
    recognitionRef.current = null;
  }, []);

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

    recognition.onresult = (event) => {
      if (!event?.results) return;

      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || result.length <= 0) continue;

        const { transcript, confidence } = result[0];
        if (result.isFinal && confidence > 0) {
          final = transcript;
        } else {
          interim += transcript;
        }
      }
      const fullTranscript = final.length > 0 ? final : interim;
      setTranscript(fullTranscript);
      onRecordRef.current?.(fullTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
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

    return cleanRecognition;
  }, [lang, continuous, interimResults, cleanRecognition]);

  const startRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !isRecording) {
      setTranscript('');
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
