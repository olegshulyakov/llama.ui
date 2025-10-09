import { memo, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  LuAtom,
  LuBrain,
  LuChevronLeft,
  LuChevronRight,
  LuCopy,
  LuGauge,
  LuGitMerge,
  LuPaperclip,
  LuRefreshCw,
  LuSquarePen,
  LuTrash2,
  LuVolume2,
  LuVolumeX,
} from 'react-icons/lu';
import { Button } from '../components/ui/button';
import { useAppContext } from '../context/app';
import { useChatContext } from '../context/chat';
import { useModals } from '../context/modal';
import IndexedDB from '../database/indexedDB';
import { useFileUpload } from '../hooks/useFileUpload';
import TextToSpeech, {
  getSpeechSynthesisVoiceByName,
  IS_SPEECH_SYNTHESIS_SUPPORTED,
} from '../hooks/useTextToSpeech';
import {
  Message,
  MessageDisplay,
  MessageExtra,
  PendingMessage,
} from '../types';
import {
  classNames,
  copyStr,
  splitMessageContent,
  timeFormatter,
} from '../utils';
import ChatInputExtraContextItem from './ChatInputExtraContextItem';
import { DropzoneArea } from './DropzoneArea';
import MarkdownDisplay from './MarkdownDisplay';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface SplitMessage {
  content: PendingMessage['content'];
  reasoning_content?: string;
}

interface ChatMessageProps {
  message: MessageDisplay;
  onRegenerateMessage(msg: Message): void;
  onEditUserMessage(msg: Message, content: string, extra: MessageExtra[]): void;
  onEditAssistantMessage(msg: Message, content: string): void;
  onChangeSibling(sibling: Message['id']): void;
}
export default memo(function ChatMessage({
  message,
  onRegenerateMessage,
  onEditUserMessage,
  onEditAssistantMessage,
  onChangeSibling,
}: ChatMessageProps) {
  const { msg, siblingCurrIdx, siblingLeafNodeIds, isPending } = message;

  const { t } = useTranslation();
  const { showConfirm } = useModals();
  const {
    config: {
      initials,
      showTokensPerSecond,
      showRawUserMessage,
      showRawAssistantMessage,
    },
  } = useAppContext();
  const { branchMessage } = useChatContext();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const timings = useMemo(
    () =>
      msg.timings
        ? {
            ...msg.timings,
            prompt_per_second:
              !msg.timings.prompt_n || !msg.timings.prompt_ms
                ? undefined
                : (msg.timings.prompt_n / msg.timings.prompt_ms) * 1000,
            predicted_per_second:
              !msg.timings.predicted_n || !msg.timings.predicted_ms
                ? undefined
                : (msg.timings.predicted_n / msg.timings.predicted_ms) * 1000,
          }
        : null,
    [msg.timings]
  );
  const { nextSibling, prevSibling } = useMemo(
    () => ({
      nextSibling: siblingLeafNodeIds[siblingCurrIdx + 1],
      prevSibling: siblingLeafNodeIds[siblingCurrIdx - 1],
    }),
    [siblingLeafNodeIds, siblingCurrIdx]
  );

  // for reasoning model, we split the message into content and thought
  // TODO: implement this as remark/rehype plugin in the future
  const { content, reasoning_content }: SplitMessage = useMemo(() => {
    if (msg.role !== 'assistant') {
      return { content: msg.content };
    }
    if (msg.reasoning_content) {
      return {
        content: msg.content,
        reasoning_content: msg.reasoning_content,
      };
    }
    return splitMessageContent(msg.content);
  }, [msg]);
  const { isUser, isAssistant } = useMemo(
    () => ({
      isUser: msg.role === 'user',
      isAssistant: msg.role === 'assistant',
    }),
    [msg.role]
  );
  const renderAsMarkdown = useMemo(() => {
    if (isUser && !showRawUserMessage) return true;
    if (isAssistant && !showRawAssistantMessage) return true;
    if (!isUser && !isAssistant) return true;
    return false;
  }, [isAssistant, isUser, showRawAssistantMessage, showRawUserMessage]);
  const showActionButtons = useMemo(
    () => !isEditing && !isPending,
    [isEditing, isPending]
  );
  const isThinking = useMemo(
    () => !!isPending && !content,
    [content, isPending]
  );

  const handleCopy = () => {
    copyStr(msg.content ?? '');
  };

  return (
    <div
      className="group"
      role="group"
      aria-description={
        isUser
          ? t('chatScreen.ariaLabels.messageUserRole')
          : isAssistant
            ? t('chatScreen.ariaLabels.messageAssistantRole')
            : undefined
      }
    >
      <div
        className={classNames({
          chat: true,
          'chat-start': isAssistant,
          'chat-end': isUser,
        })}
      >
        {/* message extra */}
        {msg.extra && msg.extra.length > 0 && !isEditing && (
          <ChatInputExtraContextItem items={msg.extra} clickToShow />
        )}

        <div
          className={classNames({
            'chat-bubble markdown': true,
            'bg-transparent': isAssistant,
          })}
        >
          {/* message metadata*/}
          <div className="mb-1 text-sm">
            {isUser && (
              <span className="font-bold mr-1">
                {initials || <Trans i18nKey="chatScreen.labels.user" />}
              </span>
            )}
            {isAssistant && msg.model && (
              <span className="font-bold mr-1">{msg.model}</span>
            )}
            <span className="text-xs opacity-40">
              {timeFormatter.format(msg.timestamp)}
            </span>
          </div>

          {/* textarea for editing message */}
          {isEditing && (
            <EditMessage
              msg={msg}
              setIsEditing={setIsEditing}
              onEditUserMessage={onEditUserMessage}
              onEditAssistantMessage={onEditAssistantMessage}
            />
          )}

          {/* render message as markdown */}
          {!isEditing && (!!content || !!reasoning_content) && (
            <div dir="auto" tabIndex={0}>
              {!!reasoning_content && (
                <ThinkingSection
                  isThinking={isThinking}
                  content={reasoning_content}
                />
              )}

              {!!content &&
                (renderAsMarkdown ? (
                  <MarkdownDisplay content={content} />
                ) : (
                  <div className="whitespace-pre-wrap">{content}</div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* actions for each message */}
      {msg.content !== null && showActionButtons && (
        <div
          className={classNames({
            'flex items-center gap-2 mx-4': true,
            'flex-row-reverse': isUser,
          })}
        >
          {/* switch message versions */}
          {siblingLeafNodeIds && siblingLeafNodeIds.length > 1 && (
            <div
              className="flex gap-1 items-center opacity-60 text-sm"
              role="navigation"
              aria-description={t('chatScreen.ariaLabels.siblingLeafs', {
                current: siblingCurrIdx + 1,
                total: siblingLeafNodeIds.length,
              })}
            >
              <Button
                className="w-6"
                variant="ghost"
                size="icon"
                onClick={() => prevSibling && onChangeSibling(prevSibling)}
                disabled={!prevSibling}
                title={t('chatScreen.titles.previous')}
                aria-label={t('chatScreen.ariaLabels.switchToPrevious')}
              >
                <LuChevronLeft className="lucide h-4 w-4" />
              </Button>
              <span>
                {siblingCurrIdx + 1} / {siblingLeafNodeIds.length}
              </span>

              <Button
                className="w-6"
                variant="ghost"
                size="icon"
                onClick={() => nextSibling && onChangeSibling(nextSibling)}
                disabled={!nextSibling}
                title={t('chatScreen.titles.next')}
                aria-label={t('chatScreen.ariaLabels.switchToNext')}
              >
                <LuChevronRight className="lucide h-4 w-4" />
              </Button>
            </div>
          )}

          {/* re-generate assistant message */}
          {isAssistant && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (msg.content !== null) {
                  onRegenerateMessage(msg as Message);
                }
              }}
              disabled={!msg.content}
              title={t('chatScreen.titles.regenerate')}
              aria-label={t('chatScreen.ariaLabels.regenerateResponse')}
            >
              <LuRefreshCw className="lucide h-4 w-4" />
            </Button>
          )}

          {/* render timings if enabled */}
          {timings && showTokensPerSecond && (
            <Button
              variant="ghost"
              size="icon"
              title={t('chatScreen.titles.performance')}
              aria-label={t('chatScreen.ariaLabels.showPerformanceMetric')}
            >
              <div className="dropdown dropdown-hover dropdown-top">
                <LuGauge className="lucide h-4 w-4" />

                <div
                  tabIndex={0}
                  className="dropdown-content rounded-box bg-base-100 z-10 w-48 px-4 py-2 shadow mt-4 text-sm text-left"
                >
                  {(timings.prompt_n || timings.prompt_ms) && (
                    <>
                      <b>Prompt Processing</b>
                      <ul className="list-inside list-disc">
                        {timings.prompt_n && (
                          <li>Tokens: {timings.prompt_n.toFixed(0)}</li>
                        )}
                        {timings.prompt_ms && (
                          <li>Time: {timings.prompt_ms.toFixed(0)} ms</li>
                        )}
                        {timings.prompt_per_second && (
                          <li>
                            Speed: {timings.prompt_per_second.toFixed(1)} t/s
                          </li>
                        )}
                      </ul>
                      <br />
                    </>
                  )}
                  {(timings.predicted_n || timings.predicted_ms) && (
                    <>
                      <b>Generation</b>
                      <ul className="list-inside list-disc">
                        {timings.predicted_n && (
                          <li>Tokens: {timings.predicted_n.toFixed(0)}</li>
                        )}
                        {timings.predicted_ms && (
                          <li>Time: {timings.predicted_ms.toFixed(0)} ms</li>
                        )}
                        {timings.predicted_per_second && (
                          <li>
                            Speed: {timings.predicted_per_second.toFixed(1)} t/s
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </Button>
          )}

          {/* edit message */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(msg.content !== null)}
            disabled={!msg.content}
            title={t('chatScreen.titles.edit')}
            aria-label={t('chatScreen.ariaLabels.editMessage')}
          >
            <LuSquarePen className="lucide h-4 w-4" />
          </Button>

          {/* copy message */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title={t('chatScreen.titles.copy')}
            aria-label={t('chatScreen.ariaLabels.copyContent')}
          >
            <LuCopy className="lucide h-4 w-4" />
          </Button>

          {/* play message */}
          <PlayButton
            disabled={!IS_SPEECH_SYNTHESIS_SUPPORTED || !content}
            text={content ?? ''}
          />

          {/* delete message */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (await showConfirm(t('chatScreen.actions.delete.confirm'))) {
                await IndexedDB.deleteMessage(msg);
              }
            }}
            disabled={!msg.content}
            title={t('chatScreen.titles.delete')}
            aria-label={t('chatScreen.ariaLabels.deleteMessage')}
          >
            <LuTrash2 className="lucide h-4 w-4" />
          </Button>

          {/* branch message */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => await branchMessage(msg as Message)}
            disabled={!msg.content}
            title={t('chatScreen.titles.branchChat')}
            aria-label={t('chatScreen.ariaLabels.branchChatAfterMessage')}
          >
            <LuGitMerge className="lucide h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});

interface EditMessageProps {
  msg: Message | PendingMessage;
  setIsEditing(flag: boolean): void;
  onEditUserMessage(msg: Message, content: string, extra: MessageExtra[]): void;
  onEditAssistantMessage(msg: Message, content: string): void;
}
function EditMessage({
  msg,
  setIsEditing,
  onEditUserMessage,
  onEditAssistantMessage,
}: EditMessageProps) {
  const { t } = useTranslation();

  const [editingContent, setEditingContent] = useState<string>(
    msg.content || ''
  );
  const extraContext = useFileUpload(msg.extra);

  return (
    <DropzoneArea
      inputId={`file-upload-${msg.id}`}
      extraContext={extraContext}
      disabled={msg.role !== 'user'}
    >
      <Textarea
        className="max-w-2xl w-[calc(90vw-8em)]"
        size="full"
        value={editingContent}
        onChange={(e) => setEditingContent(e.target.value)}
      />

      <div className="flex flex-row mt-2">
        {msg.role === 'user' && (
          <>
            <Label
              variant="btn-ghost"
              size="icon-rounded"
              htmlFor={`file-upload-${msg.id}`}
              aria-label={t('chatScreen.ariaLabels.uploadFile')}
              tabIndex={0}
              role="button"
            >
              <LuPaperclip className="lucide h-5 w-5" />
            </Label>
            <div className="grow" />
          </>
        )}

        <Button
          variant="ghost"
          className="mr-2"
          onClick={() => setIsEditing(false)}
        >
          <Trans i18nKey="chatScreen.labels.cancel" />
        </Button>

        {msg.role === 'user' && (
          <Button
            onClick={() => {
              setIsEditing(false);
              onEditUserMessage(
                msg as Message,
                editingContent,
                extraContext.items || []
              );
            }}
            disabled={!editingContent}
          >
            <Trans i18nKey="chatScreen.labels.send" />
          </Button>
        )}

        {msg.role === 'assistant' && (
          <Button
            onClick={() => {
              setIsEditing(false);
              onEditAssistantMessage(msg as Message, editingContent);
            }}
            disabled={!editingContent}
          >
            <Trans i18nKey="chatScreen.labels.save" />
          </Button>
        )}
      </div>
    </DropzoneArea>
  );
}

interface ThinkingSectionProps {
  isThinking: boolean;
  content: string;
}
const ThinkingSection = memo(function ThinkingSection({
  isThinking,
  content,
}: ThinkingSectionProps) {
  const { t } = useTranslation();
  const {
    config: { showThoughtInProgress, showRawAssistantMessage },
  } = useAppContext();

  if (!content) return null;

  return (
    <div
      role="button"
      aria-label={t('chatScreen.ariaLabels.thoughtDisplay')}
      tabIndex={0}
      className="collapse bg-none"
    >
      <input type="checkbox" defaultChecked={showThoughtInProgress} />
      <div className="collapse-title px-0 py-2">
        <div className="btn border-0 rounded-xl">
          {isThinking && (
            <>
              <LuAtom className="lucide h-6 w-6 mr-1 p-0 animate-spin" />
              <Trans i18nKey="chatScreen.labels.thinking" />
            </>
          )}
          {!isThinking && (
            <>
              <LuBrain className="lucide h-6 w-6 mr-1 p-0" />
              <Trans i18nKey="chatScreen.labels.thoughts" />
            </>
          )}
        </div>
      </div>
      <div
        className="collapse-content text-base-content/70 text-sm p-1"
        tabIndex={0}
        aria-description={t('chatScreen.ariaLabels.thoughtContent')}
      >
        <div className="border-l-2 border-base-content/20 pl-4 mb-4">
          {showRawAssistantMessage ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <MarkdownDisplay content={content} />
          )}
        </div>
      </div>
    </div>
  );
});

interface PlayButtonProps {
  className?: string;
  disabled?: boolean;
  text: string;
}
const PlayButton = memo(function PlayButton({
  className,
  disabled,
  text,
}: PlayButtonProps) {
  const { t } = useTranslation();
  const {
    config: { ttsVoice, ttsPitch, ttsRate, ttsVolume },
  } = useAppContext();
  return (
    <TextToSpeech
      text={text}
      voice={getSpeechSynthesisVoiceByName(ttsVoice)}
      pitch={ttsPitch}
      rate={ttsRate}
      volume={ttsVolume}
    >
      {({ isPlaying, play, stop }) => (
        <>
          {!isPlaying && (
            <Button
              className={className}
              variant="ghost"
              size="icon"
              onClick={play}
              disabled={disabled}
              title={t('chatScreen.titles.play')}
              aria-label={t('chatScreen.ariaLabels.playMessage')}
            >
              <LuVolume2 className="lucide h-4 w-4" />
            </Button>
          )}
          {isPlaying && (
            <Button
              className={className}
              variant="ghost"
              size="icon"
              onClick={stop}
              disabled={disabled}
              title={t('chatScreen.titles.stop')}
              aria-label={t('chatScreen.ariaLabels.stopMessage')}
            >
              <LuVolumeX className="lucide h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </TextToSpeech>
  );
});
