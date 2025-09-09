import {
  AdjustmentsHorizontalIcon,
  ArrowUpIcon,
  MicrophoneIcon,
  PaperClipIcon,
  StopCircleIcon,
  StopIcon,
} from '@heroicons/react/24/solid';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/app.context';
import { useVSCodeContext } from '../utils/llama-vscode';
import { classNames, cleanCurrentUrl } from '../utils/misc';
import { MessageExtra } from '../utils/types';
import { DropzoneArea } from './DropzoneArea';
import SpeechToText, { SpeechRecordCallback } from './SpeechToText';
import { useChatExtraContext } from './useChatExtraContext';
import { useChatTextarea } from './useChatTextarea';

/**
 * If the current URL contains "?m=...", prefill the message input with the value.
 * If the current URL contains "?q=...", prefill and SEND the message.
 */
function getPrefilledContent() {
  const searchParams = new URL(window.location.href).searchParams;
  return searchParams.get('m') || searchParams.get('q') || '';
}
function isPrefilledSend() {
  const searchParams = new URL(window.location.href).searchParams;
  return searchParams.has('q');
}
function resetPrefilled() {
  cleanCurrentUrl(['m', 'q']);
}

export function ChatInput({
  onSend,
  onStop,
  isGenerating,
}: {
  onSend: (
    content: string,
    extra: MessageExtra[] | undefined
  ) => Promise<boolean>;
  onStop: () => void;
  isGenerating: boolean;
}) {
  const { setShowSettings } = useAppContext();
  const textarea = useChatTextarea(getPrefilledContent());
  const extraContext = useChatExtraContext();
  useVSCodeContext(textarea, extraContext);

  const handleRecord: SpeechRecordCallback = useCallback(
    (text: string) => textarea.setValue(text),
    [textarea]
  );

  const sendNewMessage = async () => {
    const lastInpMsg = textarea.value();
    if (lastInpMsg.trim().length === 0) {
      toast.error('Please enter a message');
      return;
    }

    textarea.setValue('');
    if (!(await onSend(lastInpMsg, extraContext.items))) {
      // restore the input message if failed
      textarea.setValue(lastInpMsg);
    }
    // OK
    extraContext.clearItems();
  };

  // for vscode context
  textarea.refOnSubmit.current = sendNewMessage;

  useEffect(() => {
    // set textarea with prefilled value
    const prefilled = getPrefilledContent();
    if (prefilled) {
      textarea.setValue(prefilled);
    }

    // send the prefilled message if needed
    // otherwise, focus on the input
    if (isPrefilledSend()) sendNewMessage();
    else textarea.focus();

    // no need to keep track of sendNewMessage
    resetPrefilled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.href]);

  return (
    <div
      className="shrink-0 w-full lg:max-w-[900px] bg-base-100 mx-auto p-2"
      aria-label="Chat input"
    >
      <DropzoneArea
        inputId="new-message-file-upload"
        extraContext={extraContext}
        disabled={isGenerating}
      >
        <div className="bg-base-200 flex flex-col lg:border-1 lg:border-base-content/30 rounded-lg shadow-md p-2">
          <textarea
            // Default (mobile): Enable vertical resize, overflow auto for scrolling if needed
            // Large screens (lg:): Disable manual resize, apply max-height for autosize limit
            className="w-full focus:outline-none px-2 border-none focus:ring-0 resize-none"
            placeholder="Type a message (Shift+Enter to add a new line)"
            ref={textarea.ref}
            onInput={textarea.onInput} // Hook's input handler (will only resize height on lg+ screens)
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendNewMessage();
              }
            }}
            id="msg-input"
            dir="auto"
            // Set a base height of 2 rows for mobile views
            // On lg+ screens, the hook will calculate and set the initial height anyway
            rows={2}
          ></textarea>

          {/* buttons area */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2 items-center">
              <label
                htmlFor="new-message-file-upload"
                className={classNames({
                  'btn btn-ghost w-8 h-8 p-0 rounded-full': true,
                  'btn-disabled': isGenerating,
                })}
                aria-label="Upload file"
                tabIndex={0}
                role="button"
              >
                <PaperClipIcon className="h-5 w-5" />
              </label>

              <button
                className="btn btn-ghost w-8 h-8 p-0 rounded-full xl:hidden"
                title="Settings"
                aria-label="Open settings menu"
                onClick={() => setShowSettings(true)}
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center">
              {isGenerating && (
                <button
                  className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                  onClick={onStop}
                >
                  <StopIcon className="h-5 w-5" />
                </button>
              )}

              {!isGenerating && (
                <SpeechToText onRecord={handleRecord}>
                  {({ isRecording, startRecording, stopRecording }) => (
                    <>
                      {!isRecording && (
                        <button
                          className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                          onClick={startRecording}
                          title="Record"
                          aria-label="Start Recording"
                        >
                          <MicrophoneIcon className="h-5 w-5" />
                        </button>
                      )}
                      {isRecording && (
                        <button
                          className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                          onClick={stopRecording}
                          title="Stop"
                          aria-label="Stop Recording"
                        >
                          <StopCircleIcon className="h-5 w-5" />
                        </button>
                      )}
                    </>
                  )}
                </SpeechToText>
              )}

              {!isGenerating && (
                <button
                  className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                  onClick={sendNewMessage}
                  aria-label="Send message"
                >
                  <ArrowUpIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </DropzoneArea>
    </div>
  );
}
