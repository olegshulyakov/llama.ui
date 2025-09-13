import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { normalizeMsgsForAPI } from '../api/inference';
import { isDev } from '../config';
import { useInferenceContext } from '../context/inference';
import StorageUtils from '../database';
import {
  CanvasData,
  Conversation,
  InferenceApiMessage,
  Message,
  PendingMessage,
  ViewingChat,
} from '../types';

interface SendMessageProps {
  convId: Message['convId'];
  type: Message['type'];
  role: Message['role'];
  parent: Message['parent'];
  content: string | null;
  extra: Message['extra'];
  system?: string;
  onChunk: CallbackGeneratedChunk;
}
interface ReplaceMessageProps {
  msg: Message;
  newContent: string;
  onChunk: CallbackGeneratedChunk;
}

interface ChatContextValue {
  // canvas
  canvasData: CanvasData | null;
  setCanvasData: (data: CanvasData | null) => void;

  // conversations and messages
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  isGenerating: (convId: string) => boolean;
  sendMessage: (props: SendMessageProps) => Promise<boolean>;
  stopGenerating: (convId: string) => void;
  replaceMessage: (props: ReplaceMessageProps) => Promise<void>;
  branchMessage: (msg: Message) => Promise<void>;
}

// this callback is used for scrolling to the bottom of the chat and switching to the last node
export type CallbackGeneratedChunk = (currLeafNodeId?: Message['id']) => void;

const ChatContext = createContext<ChatContextValue>({
  viewingChat: null,
  pendingMessages: {},
  isGenerating: () => false,
  sendMessage: async () => false,
  stopGenerating: () => {},
  replaceMessage: async () => {},
  branchMessage: async () => {},
  canvasData: null,
  setCanvasData: () => {},
});

const getViewingChat = async (convId: string): Promise<ViewingChat | null> => {
  const conv = await StorageUtils.getOneConversation(convId);
  if (!conv) return null;
  return {
    conv: conv,
    // all messages from all branches, not filtered by last node
    messages: await StorageUtils.getMessages(convId),
  };
};

export const ChatContextProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const params = matchPath('/chat/:convId', pathname);
  const convId = params?.params?.convId;

  const [viewingChat, setViewingChat] = useState<ViewingChat | null>(null);
  const [pendingMessages, setPendingMessages] = useState<
    Record<Conversation['id'], PendingMessage>
  >({});
  const [aborts, setAborts] = useState<
    Record<Conversation['id'], AbortController>
  >({});
  const { api } = useInferenceContext();
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);

  // handle change when the convId from URL is changed
  useEffect(() => {
    // also reset the canvas data
    setCanvasData(null);
    const handleConversationChange = async (changedConvId: string) => {
      if (changedConvId !== convId) return;
      setViewingChat(await getViewingChat(changedConvId));
    };
    StorageUtils.onConversationChanged(handleConversationChange);
    getViewingChat(convId ?? '').then(setViewingChat);
    return () => {
      StorageUtils.offConversationChanged(handleConversationChange);
    };
  }, [convId]);

  const setPending = (convId: string, pendingMsg: PendingMessage | null) => {
    // if pendingMsg is null, remove the key from the object
    if (!pendingMsg) {
      setPendingMessages((prev) => {
        const newState = { ...prev };
        delete newState[convId];
        return newState;
      });
    } else {
      setPendingMessages((prev) => ({ ...prev, [convId]: pendingMsg }));
    }
  };

  const setAbort = (convId: string, controller: AbortController | null) => {
    if (!controller) {
      setAborts((prev) => {
        const newState = { ...prev };
        delete newState[convId];
        return newState;
      });
    } else {
      setAborts((prev) => ({ ...prev, [convId]: controller }));
    }
  };

  ////////////////////////////////////////////////////////////////////////
  // public functions

  const isGenerating = (convId: string) => !!pendingMessages[convId];

  const generateMessage = async ({
    convId,
    leafNodeId,
    systemMessage,
    onChunk,
  }: {
    convId: string;
    leafNodeId: Message['id'];
    systemMessage?: string;
    onChunk: CallbackGeneratedChunk;
  }) => {
    if (isGenerating(convId)) return;

    const currConversation = await StorageUtils.getOneConversation(convId);
    if (!currConversation) {
      throw new Error('Current conversation is not found');
    }

    const currMessages = StorageUtils.filterByLeafNodeId(
      await StorageUtils.getMessages(convId),
      leafNodeId,
      false
    ).filter((m) => m.role !== 'system');
    const abortController = new AbortController();
    setAbort(convId, abortController);

    if (!currMessages) {
      throw new Error('Current messages are not found');
    }

    const messages: InferenceApiMessage[] = normalizeMsgsForAPI(currMessages);
    if (systemMessage) {
      messages.unshift({ role: 'system', content: systemMessage });
    }

    const pendingId = Date.now() + 1;
    let pendingMsg: PendingMessage = {
      id: pendingId,
      convId,
      type: 'text',
      timestamp: pendingId,
      role: 'assistant',
      content: null,
      reasoning_content: null,
      parent: leafNodeId,
      children: [],
    };
    setPending(convId, pendingMsg);

    try {
      const chunks = await api.v1ChatCompletions(
        messages,
        abortController.signal
      );
      for await (const chunk of chunks) {
        if (chunk.error) {
          throw new Error(chunk.error?.message || 'Unknown error');
        }
        if (!chunk.choices || !Array.isArray(chunk.choices)) {
          console.warn('Invalid chunk format received:', chunk);
          continue;
        }
        if (chunk.choices.length === 0) {
          console.warn('Empty choices array in chunk:', chunk);
          continue;
        }

        const choice = chunk.choices[0];
        const addedContent = choice.delta.content;
        if (addedContent) {
          const lastContent = pendingMsg.content || '';
          pendingMsg = {
            ...pendingMsg,
            content: lastContent + addedContent,
          };
        }
        const reasoningContent =
          choice.delta.reasoning_content || choice.delta.reasoning;
        if (reasoningContent) {
          const lastContent = pendingMsg.reasoning_content || '';
          pendingMsg = {
            ...pendingMsg,
            reasoning_content: lastContent + reasoningContent,
          };
        }
        if (chunk.model) {
          pendingMsg.model = chunk.model;
        }
        const timings = chunk.timings;
        if (timings) {
          // only extract what's really needed, to save some space
          pendingMsg.timings = {
            prompt_n: timings.prompt_n,
            prompt_ms: timings.prompt_ms,
            predicted_n: timings.predicted_n,
            predicted_ms: timings.predicted_ms,
          };
        }
        setPending(convId, pendingMsg);
      }
    } catch (err) {
      setPending(convId, null);
      if ((err as Error).name === 'AbortError') {
        // user stopped the generation via stopGeneration() function
        // we can safely ignore this error
        if (isDev) console.debug('Generation aborted by user.');
      } else {
        console.error('Error during message generation:', err);
        toast.error(
          (err as Error)?.message ?? 'Unknown error during generation'
        );
        throw err; // rethrow
      }
    }

    if (pendingMsg.content !== null) {
      await StorageUtils.appendMsg(pendingMsg as Message, leafNodeId);
    }
    setPending(convId, null);
    onChunk(pendingId); // trigger scroll to bottom and switch to the last node
  };

  const sendMessage = async ({
    convId,
    type,
    role,
    parent,
    content,
    extra,
    system,
    onChunk,
  }: SendMessageProps): Promise<boolean> => {
    if (isGenerating(convId ?? '') || !convId || !type || !role || !parent)
      return false;

    let currMsgId;
    if (content === null) {
      // re-generate last assistant message
      currMsgId = parent;
    } else {
      currMsgId = Date.now();
      try {
        // save user message
        await StorageUtils.appendMsg(
          {
            id: currMsgId,
            convId,
            type,
            role,
            content,
            extra,
            parent,
            children: [],
            timestamp: currMsgId,
          },
          parent
        );
      } catch (err) {
        toast.error('Cannot save message.');
        return false;
      }
    }

    onChunk(currMsgId);

    try {
      await generateMessage({
        convId,
        leafNodeId: currMsgId,
        systemMessage: system,
        onChunk,
      });
      return true;
    } catch (error) {
      console.error('Message sending failed, consider rollback:', error);
      toast.error('Failed to get response from AI.');
      // TODO: rollback
    }
    return false;
  };

  const stopGenerating = (convId: string) => {
    setPending(convId, null);
    aborts[convId]?.abort();
  };

  const replaceMessage = async ({
    msg,
    newContent,
    onChunk,
  }: ReplaceMessageProps) => {
    if (isGenerating(msg.convId)) return;

    const now = Date.now();
    const currMsgId = now;
    await StorageUtils.appendMsg(
      {
        ...msg,
        id: currMsgId,
        timestamp: now,
        content: newContent,
      },
      msg.parent
    );
    onChunk(currMsgId);
  };

  const branchMessage = async (msg: Message) => {
    if (isGenerating(msg.convId)) return;

    try {
      const conv = await StorageUtils.branchConversation(msg.convId, msg.id);
      navigate(`/chat/${conv.id}`);
    } catch (error) {
      console.error('Conversation branch failed:', error);
      toast.error('Failed to branch conversation.');
    }
  };

  return (
    <ChatContext.Provider
      value={{
        viewingChat,
        pendingMessages,
        isGenerating,
        sendMessage,
        stopGenerating,
        replaceMessage,
        branchMessage,
        canvasData,
        setCanvasData,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContextProvider');
  }
  return context;
};
