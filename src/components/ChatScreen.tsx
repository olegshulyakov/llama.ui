import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CallbackGeneratedChunk,
  useMessageContext,
} from '../context/message.context';
import * as lang from '../lang/en.json';
import { classNames, getUniqueRandomElements } from '../utils/misc';
import StorageUtils from '../utils/storage';
import {
  CanvasType,
  Message,
  MessageDisplay,
  MessageExtra,
  PendingMessage,
} from '../utils/types';
import CanvasPyInterpreter from './CanvasPyInterpreter';
import { ChatInput } from './ChatInput.tsx';
import ChatMessage from './ChatMessage';
import { scrollToBottom, useChatScroll } from './useChatScroll.tsx';

function getListMessageDisplay(
  msgs: Readonly<Message[]>,
  leafNodeId: Message['id']
): MessageDisplay[] {
  const currNodes = StorageUtils.filterByLeafNodeId(msgs, leafNodeId, true);
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

export default function ChatScreen() {
  const navigate = useNavigate();
  const {
    viewingChat,
    sendMessage,
    isGenerating,
    stopGenerating,
    pendingMessages,
    canvasData,
    replaceMessage,
    replaceMessageAndGenerate,
  } = useMessageContext();

  const msgListRef = useRef<HTMLDivElement>(null);
  useChatScroll(msgListRef);

  // keep track of leaf node for rendering
  const [currNodeId, setCurrNodeId] = useState<number>(-1);
  const messages: MessageDisplay[] = useMemo(() => {
    if (!viewingChat) return [];
    else return getListMessageDisplay(viewingChat.messages, currNodeId);
  }, [currNodeId, viewingChat]);

  const currConvId = viewingChat?.conv.id ?? null;
  const pendingMsg: PendingMessage | undefined =
    pendingMessages[currConvId ?? ''];

  useEffect(() => {
    // reset to latest node when conversation changes
    setCurrNodeId(-1);
    // scroll to bottom when conversation changes
    scrollToBottom(false, 1);
  }, [currConvId]);

  const onChunk: CallbackGeneratedChunk = (currLeafNodeId?: Message['id']) => {
    if (currLeafNodeId) {
      setCurrNodeId(currLeafNodeId);
    }
    // useChatScroll will handle the auto scroll
  };

  const handleSendNewMessage = (
    content: string,
    extra: MessageExtra[] | undefined
  ) => {
    scrollToBottom(false);
    setCurrNodeId(-1);
    // get the last message node
    const lastMsgNodeId = messages.at(-1)?.msg.id ?? null;
    return sendMessage(currConvId, lastMsgNodeId, content, extra, onChunk);
  };

  const handleEditUserMessage = async (
    msg: Message,
    content: string,
    extra: MessageExtra[]
  ) => {
    if (!viewingChat) return;
    setCurrNodeId(msg.id);
    scrollToBottom(false);
    await replaceMessageAndGenerate(
      viewingChat.conv.id,
      msg,
      content,
      extra,
      onChunk
    );
    setCurrNodeId(-1);
    scrollToBottom(false);
  };

  const handleEditMessage = async (msg: Message, content: string) => {
    if (!viewingChat) return;
    setCurrNodeId(msg.id);
    scrollToBottom(false);
    await replaceMessage(viewingChat.conv.id, msg, content, onChunk);
    setCurrNodeId(-1);
    scrollToBottom(false);
  };

  const handleRegenerateMessage = async (msg: Message) => {
    if (!viewingChat) return;
    setCurrNodeId(msg.parent);
    scrollToBottom(false);
    await replaceMessageAndGenerate(
      viewingChat.conv.id,
      msg,
      null,
      msg.extra,
      onChunk
    );
    setCurrNodeId(-1);
    scrollToBottom(false);
  };

  const handleForkMessage = async (msg: Message) => {
    if (!viewingChat) return;
    
    const newConvName = `${viewingChat.conv.name} (Fork from message)`;
    try {
      const newConv = await StorageUtils.forkConversation(
        viewingChat.conv.id,
        msg.id,
        newConvName
      );
      navigate(`/chat/${newConv.id}`);
    } catch (error) {
      console.error('Failed to fork conversation:', error);
      // You might want to show a toast notification here
    }
  };

  const hasCanvas = !!canvasData;

  // due to some timing issues of StorageUtils.appendMsg(), we need to make sure the pendingMsg is not duplicated upon rendering (i.e. appears once in the saved conversation and once in the pendingMsg)
  const pendingMsgDisplay: MessageDisplay[] =
    pendingMsg && messages.at(-1)?.msg.id !== pendingMsg.id
      ? [
          {
            msg: pendingMsg,
            siblingLeafNodeIds: [],
            siblingCurrIdx: 0,
            isPending: true,
          },
        ]
      : [];

  return (
    <div
      className={classNames({
        'grid xl:gap-8 grow transition-[300ms]': true,
        'grid-cols-[1fr_0fr] xl:grid-cols-[1fr_1fr]': hasCanvas, // adapted for mobile
        'grid-cols-[1fr_0fr]': !hasCanvas,
      })}
    >
      <div
        className={classNames({
          'flex flex-col w-full xl:max-w-[900px] mx-auto': true,
          'hidden xl:flex': hasCanvas, // adapted for mobile
          flex: !hasCanvas,
        })}
      >
        {/* placeholder to shift the message to the bottom */}
        {!viewingChat && (
          <div className="grow flex flex-col items-center justify-center ">
            <b className="text-4xl">{lang.chatScreen.welcome}</b>
            <small>{lang.chatScreen.welcomeNote}</small>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-5/6 sm:max-w-3/4 mt-8">
              {getUniqueRandomElements(lang.samplePrompts, 4).map((text) => (
                <button
                  key={text}
                  className="btn h-auto bg-base-200 font-medium rounded-xl p-2"
                  onClick={() => {
                    navigate(`/chat?q=${encodeURIComponent(text)}`, {});
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* chat messages */}
        {viewingChat && (
          <div id="messages-list" className="grow" ref={msgListRef}>
            {[...messages, ...pendingMsgDisplay].map((msg) => (
              <ChatMessage
                key={msg.msg.id}
                msg={msg.msg}
                siblingLeafNodeIds={msg.siblingLeafNodeIds}
                siblingCurrIdx={msg.siblingCurrIdx}
                onRegenerateMessage={handleRegenerateMessage}
                onEditUserMessage={handleEditUserMessage}
                onEditAssistantMessage={handleEditMessage}
                onChangeSibling={setCurrNodeId}
                onForkMessage={handleForkMessage}
                isPending={msg.isPending}
              />
            ))}
          </div>
        )}

        <div
          role="group"
          aria-label="Chat input"
          className={classNames({
            'flex flex-col items-end pt-4 sticky bottom-0 bg-base-100': true,
          })}
        >
          {/* chat input */}
          <ChatInput
            onSend={handleSendNewMessage}
            onStop={() => stopGenerating(currConvId ?? '')}
            isGenerating={isGenerating(currConvId ?? '')}
          />
        </div>
      </div>
      <div className="w-full sticky top-[1em] h-[calc(100vh-8em)]">
        {canvasData?.type === CanvasType.PY_INTERPRETER && (
          <CanvasPyInterpreter />
        )}
      </div>
    </div>
  );
}
