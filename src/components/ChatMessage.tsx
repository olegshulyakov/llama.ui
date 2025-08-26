import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeTransparentIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  PencilSquareIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app.context';
import { useMessageContext } from '../context/message.context';
import { BtnWithTooltips, timeFormatter } from '../utils/common';
import { classNames, splitMessageContent } from '../utils/misc';
import { Message, MessageExtra, PendingMessage } from '../utils/types';
import ChatInputExtraContextItem from './ChatInputExtraContextItem';
import { DropzoneArea } from './DropzoneArea';
import MarkdownDisplay, { CopyButton } from './MarkdownDisplay';
import { useChatExtraContext } from './useChatExtraContext';

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
  onForkMessage,
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
  onForkMessage(msg: Message): void;
  isPending?: boolean;
}) {
  const { config } = useAppContext();
  const { viewingChat } = useMessageContext();
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
  const nextSibling = siblingLeafNodeIds[siblingCurrIdx + 1];
  const prevSibling = siblingLeafNodeIds[siblingCurrIdx - 1];

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

  if (!viewingChat) return null;

  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';

  return (
    <div
      className="group"
      id={id}
      role="group"
      aria-description={`Message from ${msg.role}`}
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
              <span className="font-bold mr-1">{config.initials}</span>
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

          {/* show loading dots for pending message */}
          {!isEditing && !content && !reasoning_content && (
            <span className="loading loading-dots loading-md"></span>
          )}

          {/* render message as markdown */}
          {!isEditing && (!!content || !!reasoning_content) && (
            <div dir="auto" tabIndex={0}>
              {!!reasoning_content && (
                <ThoughtProcess
                  isThinking={!!isPending && !content}
                  content={reasoning_content}
                />
              )}

              {!!content && (
                <MarkdownDisplay content={content} isGenerating={!!isPending} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* actions for each message */}
      {msg.content !== null && (
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
              aria-description={`Message version ${siblingCurrIdx + 1} of ${siblingLeafNodeIds.length}`}
            >
              <button
                className={classNames({
                  'btn btn-sm btn-ghost p-1': true,
                  'opacity-20': !prevSibling,
                })}
                onClick={() => prevSibling && onChangeSibling(prevSibling)}
                aria-label="Previous message version"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span>
                {siblingCurrIdx + 1} / {siblingLeafNodeIds.length}
              </span>
              <button
                className={classNames({
                  'btn btn-sm btn-ghost p-1': true,
                  'opacity-20': !nextSibling,
                })}
                onClick={() => nextSibling && onChangeSibling(nextSibling)}
                aria-label="Next message version"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* re-generate assistant message */}
          {isAssistant && !isPending && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              onClick={() => {
                if (msg.content !== null) {
                  onRegenerateMessage(msg as Message);
                }
              }}
              disabled={!msg.content}
              tooltipsContent="Regenerate response"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </BtnWithTooltips>
          )}

          {/* edit message */}
          {(isUser || (isAssistant && !isPending)) && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              onClick={() => setIsEditing(msg.content !== null)}
              disabled={!msg.content}
              tooltipsContent="Edit message"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </BtnWithTooltips>
          )}

          {/* fork/branch off message */}
          {!isPending && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              onClick={() => {
                if (msg.content !== null) {
                  onForkMessage(msg as Message);
                }
              }}
              disabled={!msg.content}
              tooltipsContent="Fork conversation from here"
            >
              <ShareIcon className="h-4 w-4" />
            </BtnWithTooltips>
          )}

          {/* render timings if enabled */}
          {isAssistant && timings && config.showTokensPerSecond && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              tooltipsContent="Performance"
            >
              <div className="dropdown dropdown-hover dropdown-top">
                <ExclamationCircleIcon className="h-4 w-4" />

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
            </BtnWithTooltips>
          )}
          <CopyButton className="btn-mini w-8 h-8" content={msg.content} />
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
}: {
  msg: Message | PendingMessage;
  setIsEditing(flag: boolean): void;
  onEditUserMessage(msg: Message, content: string, extra: MessageExtra[]): void;
  onEditAssistantMessage(msg: Message, content: string): void;
}) {
  const [editingContent, setEditingContent] = useState<string>(
    msg.content || ''
  );
  const extraContext = useChatExtraContext(msg.extra);

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
              aria-label="Upload file"
              tabIndex={0}
              role="button"
            >
              <PaperClipIcon className="h-5 w-5" />
            </label>
            <div className="grow" />
          </>
        )}

        <button
          className="btn btn-ghost mr-2"
          onClick={() => setIsEditing(false)}
        >
          Cancel
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
            Send
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
            Save
          </button>
        )}
      </div>
    </DropzoneArea>
  );
}

function ThoughtProcess({
  isThinking,
  content,
}: {
  isThinking: boolean;
  content: string;
}) {
  const { config } = useAppContext();
  return (
    <div
      role="button"
      aria-label="Toggle thought process display"
      tabIndex={0}
      className={classNames({
        'collapse bg-none': true,
      })}
    >
      <input type="checkbox" defaultChecked={config.showThoughtInProgress} />
      <div className="collapse-title px-0 py-2">
        <div className="btn border-0 rounded-xl">
          {isThinking && (
            <>
              <CubeTransparentIcon className="w-6 h-6 mr-1 p-0 animate-spin" />
              Thinking
            </>
          )}
          {!isThinking && (
            <>
              <CubeTransparentIcon className="w-6 h-6 mr-1 p-0" />
              Thoughts
            </>
          )}
        </div>
      </div>
      <div
        className="collapse-content text-base-content/70 text-sm p-1"
        tabIndex={0}
        aria-description="Thought process content"
      >
        <div className="border-l-2 border-base-content/20 pl-4 mb-4">
          <MarkdownDisplay content={content} />
        </div>
      </div>
    </div>
  );
}
