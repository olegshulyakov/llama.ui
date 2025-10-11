import { memo, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { useNavigate } from 'react-router';
import { Button, Icon, Label, Textarea } from '../../../components';
import {
  ChatTextareaApi,
  useChatTextarea,
} from '../../../hooks/useChatTextarea';
import { useFileUpload } from '../../../hooks/useFileUpload';
import SpeechToText, {
  IS_SPEECH_RECOGNITION_SUPPORTED,
  SpeechRecordCallback,
} from '../../../hooks/useSpeechToText';
import { useChatContext } from '../../../store/chat';
import { MessageExtra } from '../../../types';
import { usePrefilledMessage } from '../hooks/usePrefilledMessage';
import { DropzoneArea } from './DropzoneArea';

type CallbackSendMessage = (
  content: string,
  extra: MessageExtra[] | undefined
) => Promise<boolean>;

export const ChatInput = memo(
  ({ convId, onSend }: { convId?: string; onSend: CallbackSendMessage }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { prefilledContent, isPrefilledSend } = usePrefilledMessage();
    const textarea: ChatTextareaApi = useChatTextarea(prefilledContent);
    const extraContext = useFileUpload();
    const { isGenerating, stopGenerating } = useChatContext();

    const isPending = useMemo(
      () => (!convId ? false : isGenerating(convId)),
      [convId, isGenerating]
    );

    const handleStop = useCallback(() => {
      if (!convId) return;
      stopGenerating(convId);
    }, [convId, stopGenerating]);

    const handleRecord: SpeechRecordCallback = useCallback(
      (text: string) => textarea.setValue(text),
      [textarea]
    );

    const sendNewMessage = async () => {
      const lastInpMsg = textarea.value();
      if (lastInpMsg.trim().length === 0) {
        toast.error(t('chatInput.errors.emptyMessage'));
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
      if (prefilledContent) {
        textarea.setValue(prefilledContent);
      }

      // send the prefilled message if needed
      // otherwise, focus on the input
      if (isPrefilledSend) sendNewMessage();
      else textarea.focus();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPrefilledSend, prefilledContent]);

    return (
      <div
        className="shrink-0 w-full lg:max-w-[900px] bg-base-100 mx-auto p-1 md:p-2"
        aria-label={t('chatInput.ariaLabels.chatInput')}
      >
        <DropzoneArea
          inputId="new-message-file-upload"
          extraContext={extraContext}
          disabled={isPending}
        >
          <div className="bg-base-200 flex flex-col lg:border-1 lg:border-base-content/30 rounded-lg shadow-sm md:shadow-md p-2">
            <Textarea
              // Default (mobile): Enable vertical resize, overflow auto for scrolling if needed
              // Large screens (lg:): Disable manual resize, apply max-height for autosize limit
              className="text-base p-0 px-2"
              variant="transparent"
              size="full"
              placeholder={t('chatInput.placeholder')}
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
              // Set a base height of 2 rows for mobile views
              // On lg+ screens, the hook will calculate and set the initial height anyway
              rows={2}
            />

            {/* buttons area */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2 items-center">
                <Label
                  className={isPending ? 'btn-disabled' : ''}
                  variant="btn-ghost"
                  size="icon-rounded"
                  htmlFor="new-message-file-upload"
                  aria-label={t('chatInput.ariaLabels.uploadFile')}
                  tabIndex={0}
                  role="button"
                >
                  <Icon icon="LuPaperclip" size="md" />
                </Label>

                <Button
                  className="xl:hidden"
                  variant="ghost"
                  size="icon-rounded"
                  title={t('header.title.settings')}
                  aria-label={t('header.ariaLabels.settings')}
                  onClick={() => navigate('/settings')}
                >
                  <TbAdjustmentsHorizontal className="lucide h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center">
                {IS_SPEECH_RECOGNITION_SUPPORTED && !isPending && (
                  <SpeechToText onRecord={handleRecord}>
                    {({ isRecording, startRecording, stopRecording }) => (
                      <>
                        {!isRecording && (
                          <Button
                            className="mr-2"
                            variant="ghost"
                            size="icon-rounded"
                            onClick={startRecording}
                            title="Record"
                            aria-label="Start Recording"
                          >
                            <Icon icon="LuMic" size="md" />
                          </Button>
                        )}
                        {isRecording && (
                          <Button
                            className="mr-2"
                            variant="ghost"
                            size="icon-rounded"
                            onClick={stopRecording}
                            title="Stop"
                            aria-label="Stop Recording"
                          >
                            <Icon icon="LuCircleStop" size="md" />
                          </Button>
                        )}
                      </>
                    )}
                  </SpeechToText>
                )}

                {isPending && (
                  <Button
                    variant="neutral"
                    size="icon-rounded"
                    onClick={handleStop}
                  >
                    <Icon icon="LuSquare" size="sm" variant="current" />
                  </Button>
                )}

                {!isPending && (
                  <Button
                    variant="neutral"
                    size="icon-rounded"
                    onClick={sendNewMessage}
                    aria-label={t('chatInput.ariaLabels.send')}
                  >
                    <Icon icon="LuArrowUp" size="md" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DropzoneArea>
      </div>
    );
  }
);
