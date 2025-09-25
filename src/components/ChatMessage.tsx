import {
  Atom,
  Brain,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  GitMerge,
  Paperclip,
  RefreshCw,
  SquarePen,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useAppContext } from '../context/app';
import { useChatContext } from '../context/chat';
import { useModals } from '../context/modal';
import StorageUtils from '../database';
import { useFileUpload } from '../hooks/useFileUpload';
import { Message, MessageExtra, PendingMessage } from '../types';
import {
  classNames,
  copyStr,
  splitMessageContent,
  timeFormatter,
} from '../utils';
import ChatInputExtraContextItem from './ChatInputExtraContextItem';
import { IntlIconButton } from './common';
import { DropzoneArea } from './DropzoneArea';
import MarkdownDisplay from './MarkdownDisplay';
import TextToSpeech, {
  getSpeechSynthesisVoiceByName,
  IS_SPEECH_SYNTHESIS_SUPPORTED,
} from './TextToSpeech';

interface SplitMessage {
  content: PendingMessage['content'];
  reasoning_content?: string;
}

export default function ChatMessage({
  msg,
  siblingLeafNodeIds,
  siblingCurrIdx,
  id,
  onRegenerateMessage,
  onEditUserMessage,
  onEditAssistantMessage,
  onChangeSibling,
  isPending,
}: {
  msg: Message | PendingMessage;
  siblingLeafNodeIds: Message['id'][];
  siblingCurrIdx: number;
  id?: string;
  onRegenerateMessage(msg: Message): void;
  onEditUserMessage(msg: Message, content: string, extra: MessageExtra[]): void;
  onEditAssistantMessage(msg: Message, content: string): void;
  onChangeSibling(sibling: Message['id']): void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const { showConfirm } = useModals();
  const {
    config: { initials, showTokensPerSecond },
  } = useAppContext();
  const { branchMessage } = useChatContext();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const timings = useMemo(
    () =>
      msg.timings
        ? {
            ...msg.timings,
            prompt_per_second:
              (msg.timings.prompt_n / msg.timings.prompt_ms) * 1000,
            predicted_per_second:
              (msg.timings.predicted_n / msg.timings.predicted_ms) * 1000,
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
  const showActionButtons = useMemo(
    () => !isEditing && (isUser || (isAssistant && !isPending)),
    [isEditing, isPending, isUser, isAssistant]
  );

  const handleCopy = () => {
    copyStr(msg.content ?? '');
  };

  return (
    <div
      className="group"
      id={id}
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
              t={t}
            />
          )}

          {/* render message as markdown */}
          {!isEditing && (!!content || !!reasoning_content) && (
            <div dir="auto" tabIndex={0}>
              {!!reasoning_content && (
                <ThoughtProcess
                  isThinking={!!isPending && !content}
                  content={reasoning_content}
                  t={t}
                />
              )}

              {!!content && (
                <MarkdownDisplay content={content} isGenerating={!!isPending} />
              )}
            </div>
          )}

          {/* show loading dots for pending message */}
          {!isEditing && isPending && (
            <span className="loading loading-dots loading-md"></span>
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
              <IntlIconButton
                className="btn btn-ghost w-6 h-8 p-0"
                onClick={() => prevSibling && onChangeSibling(prevSibling)}
                disabled={!prevSibling}
                icon={ChevronLeft}
                t={t}
                titleKey="chatScreen.titles.previous"
                ariaLabelKey="chatScreen.ariaLabels.switchToPrevious"
              />
              <span>
                {siblingCurrIdx + 1} / {siblingLeafNodeIds.length}
              </span>

              <IntlIconButton
                className="btn btn-ghost w-6 h-8 p-0"
                onClick={() => nextSibling && onChangeSibling(nextSibling)}
                disabled={!nextSibling}
                icon={ChevronRight}
                t={t}
                titleKey="chatScreen.titles.next"
                ariaLabelKey="chatScreen.ariaLabels.switchToNext"
              />
            </div>
          )}

          {/* re-generate assistant message */}
          {isAssistant && (
            <button
              className="btn btn-ghost w-8 h-8 p-0"
              onClick={() => {
                if (msg.content !== null) {
                  onRegenerateMessage(msg as Message);
                }
              }}
              disabled={!msg.content}
              title={t('chatScreen.titles.regenerate')}
              aria-label={t('chatScreen.ariaLabels.regenerateResponse')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* render timings if enabled */}
          {isAssistant && timings && showTokensPerSecond && (
            <button
              className="btn btn-ghost w-8 h-8 p-0"
              title={t('chatScreen.titles.performance')}
              aria-label={t('chatScreen.ariaLabels.showPerformanceMetric')}
            >
              <div className="dropdown dropdown-hover dropdown-top">
                <Gauge className="h-4 w-4" />

                <div
                  tabIndex={0}
                  className="dropdown-content rounded-box bg-base-100 z-10 w-48 px-4 py-2 shadow mt-4 text-sm text-left"
                >
                  <b>Prompt Processing</b>
                  <ul className="list-inside list-disc">
                    <li>Tokens: {timings.prompt_n.toFixed(0)}</li>
                    <li>Time: {timings.prompt_ms.toFixed(0)} ms</li>
                    <li>Speed: {timings.prompt_per_second.toFixed(1)} t/s</li>
                  </ul>
                  <br />
                  <b>Generation</b>
                  <ul className="list-inside list-disc">
                    <li>Tokens: {timings.predicted_n.toFixed(0)}</li>
                    <li>Time: {timings.predicted_ms.toFixed(0)} ms</li>
                    <li>
                      Speed: {timings.predicted_per_second.toFixed(1)} t/s
                    </li>
                  </ul>
                </div>
              </div>
            </button>
          )}

          {/* edit message */}
          <IntlIconButton
            className="btn btn-ghost w-8 h-8 p-0"
            onClick={() => setIsEditing(msg.content !== null)}
            disabled={!msg.content}
            icon={SquarePen}
            t={t}
            titleKey="chatScreen.titles.edit"
            ariaLabelKey="chatScreen.ariaLabels.editMessage"
          />

          {/* copy message */}
          <IntlIconButton
            className="btn btn-ghost w-8 h-8 p-0"
            onClick={handleCopy}
            icon={Copy}
            t={t}
            titleKey="chatScreen.titles.copy"
            ariaLabelKey="chatScreen.ariaLabels.copyContent"
          />

          {/* play message */}
          <PlayButton
            className="btn btn-ghost w-8 h-8 p-0"
            disabled={!IS_SPEECH_SYNTHESIS_SUPPORTED || !content}
            text={content ?? ''}
            t={t}
          />

          {/* delete message */}
          <IntlIconButton
            className="btn btn-ghost w-8 h-8 p-0"
            onClick={async () => {
              if (await showConfirm(t('chatScreen.actions.delete.confirm'))) {
                await StorageUtils.deleteMessage(msg);
              }
            }}
            disabled={!msg.content}
            icon={Trash2}
            t={t}
            titleKey="chatScreen.titles.delete"
            ariaLabelKey="chatScreen.ariaLabels.deleteMessage"
          />

          {/* branch message */}
          <IntlIconButton
            className="btn btn-ghost w-8 h-8 p-0"
            onClick={async () => await branchMessage(msg as Message)}
            disabled={!msg.content}
            t={t}
            titleKey="chatScreen.titles.branchChat"
            ariaLabelKey="chatScreen.ariaLabels.branchChatAfterMessage"
            icon={GitMerge}
          />
        </div>
      )}
    </div>
  );
}

function EditMessage({
  msg,
  setIsEditing,
  onEditUserMessage,
  onEditAssistantMessage,
  t,
}: {
  msg: Message | PendingMessage;
  setIsEditing(flag: boolean): void;
  onEditUserMessage(msg: Message, content: string, extra: MessageExtra[]): void;
  onEditAssistantMessage(msg: Message, content: string): void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
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
      <textarea
        dir="auto"
        className="textarea textarea-bordered bg-base-100 text-base-content max-w-2xl w-[calc(90vw-8em)] h-24"
        value={editingContent}
        onChange={(e) => setEditingContent(e.target.value)}
      ></textarea>

      <div className="flex flex-row mt-2">
        {msg.role === 'user' && (
          <>
            <label
              htmlFor={`file-upload-${msg.id}`}
              className="btn w-8 h-8 mt-1 p-0 rounded-full"
              aria-label={t('chatScreen.ariaLabels.uploadFile')}
              tabIndex={0}
              role="button"
            >
              <Paperclip className="h-5 w-5" />
            </label>
            <div className="grow" />
          </>
        )}

        <button
          className="btn btn-ghost mr-2"
          onClick={() => setIsEditing(false)}
        >
          <Trans i18nKey="chatScreen.labels.cancel" />
        </button>

        {msg.role === 'user' && (
          <button
            className="btn"
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
          </button>
        )}

        {msg.role === 'assistant' && (
          <button
            className="btn"
            onClick={() => {
              setIsEditing(false);
              onEditAssistantMessage(msg as Message, editingContent);
            }}
            disabled={!editingContent}
          >
            <Trans i18nKey="chatScreen.labels.save" />
          </button>
        )}
      </div>
    </DropzoneArea>
  );
}

function ThoughtProcess({
  isThinking,
  content,
  t,
}: {
  isThinking: boolean;
  content: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const {
    config: { showThoughtInProgress },
  } = useAppContext();
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
              <Atom className="h-6 w-6 mr-1 p-0 animate-spin" />
              <Trans i18nKey="chatScreen.labels.thinking" />
            </>
          )}
          {!isThinking && (
            <>
              <Brain className="h-6 w-6 mr-1 p-0" />
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
          <MarkdownDisplay content={content} />
        </div>
      </div>
    </div>
  );
}

const PlayButton = ({
  className,
  disabled,
  text,
  t,
}: {
  className?: string;
  disabled?: boolean;
  text: string;
  t: ReturnType<typeof useTranslation>['t'];
}) => {
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
        <Fragment>
          {!isPlaying && (
            <IntlIconButton
              className={className}
              onClick={play}
              disabled={disabled}
              t={t}
              titleKey="chatScreen.titles.play"
              ariaLabelKey="chatScreen.ariaLabels.playMessage"
              icon={Volume2}
            />
          )}
          {isPlaying && (
            <IntlIconButton
              className={className}
              onClick={stop}
              disabled={disabled}
              t={t}
              titleKey="chatScreen.titles.stop"
              ariaLabelKey="chatScreen.ariaLabels.stopMessage"
              icon={VolumeX}
            />
          )}
        </Fragment>
      )}
    </TextToSpeech>
  );
};
