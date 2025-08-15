import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useAppContext } from '../utils/app.context';
import { BtnWithTooltips, timeFormatter } from '../utils/common';
import { classNames } from '../utils/misc';
import { Message, PendingMessage } from '../utils/types';
import ChatInputExtraContextItem from './ChatInputExtraContextItem';
import MarkdownDisplay, { CopyButton } from './MarkdownDisplay';

interface SplitMessage {
  content: PendingMessage['content'];
  thought?: string;
  isThinking?: boolean;
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
  onEditUserMessage(msg: Message, content: string): void;
  onEditAssistantMessage(msg: Message, content: string): void;
  onChangeSibling(sibling: Message['id']): void;
  isPending?: boolean;
}) {
  const { viewingChat, config } = useAppContext();
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
  const { content, thought, isThinking }: SplitMessage = useMemo(() => {
    if (msg.content === null || msg.role !== 'assistant') {
      return { content: msg.content };
    }
    const REGEX_THINK_OPEN = /<think>|<\|channel\|>analysis<\|message\|>/;
    const REGEX_THINK_CLOSE =
      /<\/think>|<\|start\|>assistant<\|channel\|>final<\|message\|>/;
    let actualContent = '';
    let thought = '';
    let isThinking = false;
    let thinkSplit = msg.content.split(REGEX_THINK_OPEN, 2);
    actualContent += thinkSplit[0];
    while (thinkSplit[1] !== undefined) {
      // <think> tag found
      thinkSplit = thinkSplit[1].split(REGEX_THINK_CLOSE, 2);
      thought += thinkSplit[0];
      isThinking = true;
      if (thinkSplit[1] !== undefined) {
        // </think> closing tag found
        isThinking = false;
        thinkSplit = thinkSplit[1].split(REGEX_THINK_OPEN, 2);
        actualContent += thinkSplit[0];
      }
    }
    return { content: actualContent, thought, isThinking };
  }, [msg]);

  if (!viewingChat) return null;

  const isUser = msg.role === 'user';

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
          'chat-start': !isUser,
          'chat-end': isUser,
        })}
      >
        {/* message extra */}
        {msg.extra && msg.extra.length > 0 && (
          <ChatInputExtraContextItem items={msg.extra} clickToShow />
        )}

        <div
          className={classNames({
            'chat-bubble markdown': true,
            'bg-transparent': !isUser,
          })}
        >
          {/* message metadata*/}
          {msg.role === 'assistant' && (
            <div className="mb-1 text-sm">
              {msg.model && <span className="font-bold mr-1">{msg.model}</span>}
              <span className="text-xs opacity-40">
                {timeFormatter.format(msg.timestamp)}
              </span>
            </div>
          )}

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
          {!isEditing && content === null && (
            <span className="loading loading-dots loading-md"></span>
          )}

          {/* render message as markdown */}
          {!isEditing && content !== null && (
            <div dir="auto" tabIndex={0}>
              {thought && (
                <ThoughtProcess
                  isThinking={!!isThinking && !!isPending}
                  content={thought}
                  open={config.showThoughtInProgress}
                />
              )}

              <MarkdownDisplay content={content} isGenerating={isPending} />
            </div>
          )}
        </div>
      </div>

      {/* actions for each message */}
      {msg.content !== null && (
        <div
          className={classNames({
            'flex items-center gap-2 mx-4 mb-2': true,
            'flex-row-reverse': msg.role === 'user',
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
          {msg.role === 'assistant' && !isPending && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              onClick={() => {
                if (msg.content !== null) {
                  onRegenerateMessage(msg as Message);
                }
              }}
              disabled={msg.content === null}
              tooltipsContent="Regenerate response"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </BtnWithTooltips>
          )}

          {/* edit message */}
          {(msg.role === 'user' ||
            (msg.role === 'assistant' && !isPending)) && (
            <BtnWithTooltips
              className="btn-mini w-8 h-8"
              onClick={() => setIsEditing(msg.content !== null)}
              disabled={msg.content === null}
              tooltipsContent="Edit message"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </BtnWithTooltips>
          )}

          {/* render timings if enabled */}
          {msg.role === 'assistant' &&
            timings &&
            config.showTokensPerSecond && (
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
                      <li>Tokens: {timings.prompt_n}</li>
                      <li>Time: {timings.prompt_ms} ms</li>
                      <li>Speed: {timings.prompt_per_second.toFixed(1)} t/s</li>
                    </ul>
                    <br />
                    <b>Generation</b>
                    <ul className="list-inside list-disc">
                      <li>Tokens: {timings.predicted_n}</li>
                      <li>Time: {timings.predicted_ms} ms</li>
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
  onEditUserMessage(msg: Message, content: string): void;
  onEditAssistantMessage(msg: Message, content: string): void;
}) {
  const [editingContent, setEditingContent] = useState<string>(
    msg.content || ''
  );

  return (
    <>
      <textarea
        dir="auto"
        className="textarea textarea-bordered bg-base-100 text-base-content max-w-2xl w-[calc(90vw-8em)] h-24"
        value={editingContent}
        onChange={(e) => setEditingContent(e.target.value)}
      ></textarea>

      <div className="flex flex-row">
        <button
          className="btn btn-ghost mt-2 mr-2"
          onClick={() => setIsEditing(false)}
        >
          Cancel
        </button>

        {msg.role === 'user' && (
          <button
            className="btn mt-2"
            onClick={() => {
              setIsEditing(false);
              onEditUserMessage(msg as Message, editingContent);
            }}
            disabled={!editingContent}
          >
            Send
          </button>
        )}

        {msg.role === 'assistant' && (
          <button
            className="btn mt-2"
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
    </>
  );
}

function ThoughtProcess({
  isThinking,
  content,
  open,
}: {
  isThinking: boolean;
  content: string;
  open: boolean;
}) {
  return (
    <div
      role="button"
      aria-label="Toggle thought process display"
      tabIndex={0}
      className={classNames({
        'collapse bg-none': true,
      })}
    >
      <input type="checkbox" defaultChecked={open} />
      <div className="collapse-title px-0">
        <div className="btn rounded-xl">
          {isThinking ? (
            <span>
              <span
                className="loading loading-spinner loading-md mr-2"
                style={{ verticalAlign: 'middle' }}
              ></span>
              Thinking
            </span>
          ) : (
            <>Thought Process</>
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
