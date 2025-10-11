import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IndexedDB from '../../database/indexedDB';
import { useChatScroll } from '../../hooks/useChatScroll';
import { useAppContext } from '../../store/app';
import { CallbackGeneratedChunk, useChatContext } from '../../store/chat';
import {
  CanvasType,
  Conversation,
  Message,
  MessageDisplay,
  MessageExtra,
} from '../../types';
import { classNames } from '../../utils';
import CanvasPyInterpreter from './components/CanvasPyInterpreter';
import { ChatInput } from './components/ChatInput';
import ChatMessage from './components/ChatMessage';

function getListMessageDisplay(
  msgs: Readonly<Message[]>,
  leafNodeId: Message['id']
): MessageDisplay[] {
  const currNodes = IndexedDB.filterByLeafNodeId(msgs, leafNodeId, true);
  const res: MessageDisplay[] = [];
  const nodeMap = new Map<Message['id'], Message>();
  for (const msg of msgs) {
    nodeMap.set(msg.id, msg);
  }
  // find leaf node from a message node
  const findLeafNode = (msgId: Message['id']): Message['id'] => {
    let currNode: Message | undefined = nodeMap.get(msgId);
    while (currNode) {
      if (currNode.children.length === 0) break;
      currNode = nodeMap.get(currNode.children.at(-1) ?? -1);
    }
    return currNode?.id ?? -1;
  };
  // traverse the current nodes
  for (const msg of currNodes) {
    const parentNode = nodeMap.get(msg.parent ?? -1);
    if (!parentNode) continue;
    const siblings = parentNode.children;
    if (msg.type !== 'root') {
      res.push({
        msg,
        siblingLeafNodeIds: siblings.map(findLeafNode),
        siblingCurrIdx: siblings.indexOf(msg.id),
      });
    }
  }
  return res;
}

export default function ChatScreen({
  currConvId,
}: {
  currConvId: Conversation['id'];
}) {
  const {
    config: { systemMessage },
  } = useAppContext();
  const { viewingChat, sendMessage, canvasData, replaceMessage } =
    useChatContext();
  const { pendingMessages } = useChatContext();

  const msgListRef = useRef<HTMLDivElement>(null);
  const [currNodeId, setCurrNodeId] = useState<number>(-1); // keep track of leaf node for rendering

  const { scrollImmediate, scrollToBottom } = useChatScroll(msgListRef);
  const hasCanvas = useMemo(() => !!canvasData, [canvasData]);

  const { messages, lastMsgNodeId } = useMemo(() => {
    if (!viewingChat?.messages) {
      return {
        messages: [],
        lastMsgNodeId: -1,
      };
    }
    const messages = getListMessageDisplay(viewingChat.messages, currNodeId);
    const lastMsgNodeId = messages.at(-1)?.msg.id ?? -1; // get the last message node
    return {
      messages,
      lastMsgNodeId,
    };
  }, [viewingChat?.messages, currNodeId]);

  const pendingMsg = useMemo(() => {
    const pendingMsg = pendingMessages[currConvId];
    // due to some timing issues of StorageUtils.appendMsg(), we need to make sure the pendingMsg is not duplicated upon rendering (i.e. appears once in the saved conversation and once in the pendingMsg)
    if (!pendingMsg || messages.at(-1)?.msg.id === pendingMsg.id) {
      return null;
    }

    scrollToBottom();

    return {
      msg: pendingMsg,
      siblingLeafNodeIds: [],
      siblingCurrIdx: 0,
      isPending: true,
    };
  }, [currConvId, messages, pendingMessages, scrollToBottom]);

  useEffect(() => {
    // reset to latest node when conversation changes
    setCurrNodeId(-1);
    // scroll to bottom when conversation changes
    scrollImmediate('smooth');
  }, [currConvId, scrollImmediate]);

  const onChunk: CallbackGeneratedChunk = useCallback(
    (currLeafNodeId?: Message['id']) => {
      if (currLeafNodeId) {
        setCurrNodeId(currLeafNodeId);
      }
    },
    []
  );

  const handleSendNewMessage = useCallback(
    async (content: string, extra: MessageExtra[] | undefined) => {
      const isSent = await sendMessage({
        convId: currConvId,
        type: 'text',
        role: 'user',
        parent: lastMsgNodeId,
        content,
        extra,
        system: systemMessage,
        onChunk,
      });
      return isSent;
    },
    [currConvId, lastMsgNodeId, systemMessage, onChunk, sendMessage]
  );

  const handleEditUserMessage = useCallback(
    async (msg: Message, content: string, extra: MessageExtra[]) => {
      if (!currConvId) return;
      setCurrNodeId(msg.id);
      await sendMessage({
        ...msg,
        convId: currConvId,
        content,
        extra,
        system: systemMessage,
        onChunk,
      });
    },
    [currConvId, systemMessage, onChunk, sendMessage]
  );

  const handleEditMessage = useCallback(
    async (msg: Message, content: string) => {
      if (!currConvId) return;
      setCurrNodeId(msg.id);
      await replaceMessage({ msg, newContent: content, onChunk });
    },
    [replaceMessage, currConvId, onChunk]
  );

  const handleRegenerateMessage = useCallback(
    async (msg: Message) => {
      if (!currConvId) return;
      setCurrNodeId(msg.parent);

      await sendMessage({
        ...msg,
        convId: currConvId,
        content: null,
        extra: [],
        system: systemMessage,
        onChunk,
      });
    },
    [currConvId, systemMessage, onChunk, sendMessage]
  );

  const dummyCallback = useCallback(() => {}, []);

  return (
    <div className="flex flex-col h-full">
      {/* main content area */}
      <div ref={msgListRef} className="grow flex flex-col overflow-y-auto px-2">
        <div
          className={classNames({
            'grid xl:gap-8 grow transition-[300ms]': true,
            'grid-cols-1 xl:grid-cols-2': hasCanvas, // adapted for mobile
            'grid-cols-1': !hasCanvas,
          })}
        >
          {/* chat messages */}
          <div
            className={classNames({
              'flex flex-col w-full xl:max-w-[900px] mx-auto': true,
              'hidden xl:flex': hasCanvas, // adapted for mobile
              flex: !hasCanvas,
            })}
          >
            {/* chat messages */}
            {currConvId && (
              <div id="messages-list" className="grow">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.msg.id}
                    message={msg}
                    onRegenerateMessage={handleRegenerateMessage}
                    onEditUserMessage={handleEditUserMessage}
                    onEditAssistantMessage={handleEditMessage}
                    onChangeSibling={setCurrNodeId}
                  />
                ))}

                {!!pendingMsg && (
                  <ChatMessage
                    key={pendingMsg.msg.id}
                    message={pendingMsg}
                    onRegenerateMessage={dummyCallback}
                    onEditUserMessage={dummyCallback}
                    onEditAssistantMessage={dummyCallback}
                    onChangeSibling={dummyCallback}
                  />
                )}

                {/* show loading dots for pending message */}
                {!!pendingMsg && (
                  <span className="loading loading-dots loading-md"></span>
                )}
              </div>
            )}
          </div>

          {/* canvas area */}
          {hasCanvas && (
            <div className="w-full sticky top-[1em] h-[calc(100vh-14em)] xl:h-[calc(100vh-16em)]">
              {canvasData?.type === CanvasType.PY_INTERPRETER && (
                <CanvasPyInterpreter />
              )}
            </div>
          )}
        </div>
      </div>

      {/* chat input */}
      <ChatInput
        key={currConvId}
        convId={currConvId}
        onSend={handleSendNewMessage}
      />
    </div>
  );
}
