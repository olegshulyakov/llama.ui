import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { LuArrowUp, LuPaperclip, LuSquare } from 'react-icons/lu';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { useNavigate } from 'react-router';
import { ChatTextareaApi, useChatTextarea } from '../hooks/useChatTextarea';
import { useFileUpload } from '../hooks/useFileUpload';
import { usePrefilledMessage } from '../hooks/usePrefilledMessage';
import { MessageExtra } from '../types';
import { classNames } from '../utils';
import { DropzoneArea } from './DropzoneArea';

/**
 * If the current URL contains "?m=...", prefill the message input with the value.
 * If the current URL contains "?q=...", prefill and SEND the message.
 */

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prefilledContent, shouldSendPrefilled } = usePrefilledMessage();
  const textarea: ChatTextareaApi = useChatTextarea(prefilledContent);
  const extraContext = useFileUpload();

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
    if (shouldSendPrefilled) {
      sendNewMessage();
    } else if (prefilledContent) {
      textarea.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSendPrefilled, prefilledContent]);

  return (
    <div
      className="shrink-0 w-full lg:max-w-[900px] bg-base-100 mx-auto p-1 md:p-2"
      aria-label={t('chatInput.ariaLabels.chatInput')}
    >
      <DropzoneArea
        inputId="new-message-file-upload"
        extraContext={extraContext}
        disabled={isGenerating}
      >
        <div className="bg-base-200 flex flex-col lg:border-1 lg:border-base-content/30 rounded-lg shadow-sm md:shadow-md p-2">
          <textarea
            // Default (mobile): Enable vertical resize, overflow auto for scrolling if needed
            // Large screens (lg:): Disable manual resize, apply max-height for autosize limit
            className="w-full focus:outline-none px-2 border-none focus:ring-0 resize-none"
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
                aria-label={t('chatInput.ariaLabels.uploadFile')}
                tabIndex={0}
                role="button"
              >
                <LuPaperclip className="lucide h-5 w-5" />
              </label>

              <button
                className="btn btn-ghost w-8 h-8 p-0 rounded-full xl:hidden"
                title={t('header.title.settings')}
                aria-label={t('header.ariaLabels.settings')}
                onClick={() => navigate('/settings')}
              >
                <TbAdjustmentsHorizontal className="lucide h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center">
              {isGenerating && (
                <button
                  className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                  onClick={onStop}
                >
                  <LuSquare className="lucide h-4 w-4" fill="currentColor" />
                </button>
              )}

              {!isGenerating && (
                <button
                  className="btn btn-neutral w-8 h-8 p-0 rounded-full"
                  onClick={sendNewMessage}
                  aria-label={t('chatInput.ariaLabels.send')}
                >
                  <LuArrowUp className="lucide h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </DropzoneArea>
    </div>
  );
}
