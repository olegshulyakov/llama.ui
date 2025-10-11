import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { configToCustomOptions, normalizeMsgsForAPI } from '../api/utils';
import { isDev } from '../config';
import IndexedDB from '../database/indexedDB';
import {
  CanvasData,
  Conversation,
  InferenceApiMessage,
  Message,
  PendingMessage,
  ViewingChat,
} from '../types';
import { filterThoughtFromMsgs } from '../utils';
import { useAppContext } from './app';
import { useInferenceContext } from './inference';

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

// Define action types enum
enum ChatActionType {
  SET_VIEWING_CHAT = 'SET_VIEWING_CHAT',
  SET_PENDING_MESSAGE = 'SET_PENDING_MESSAGE',
  REMOVE_PENDING_MESSAGE = 'REMOVE_PENDING_MESSAGE',
  SET_ABORT_CONTROLLER = 'SET_ABORT_CONTROLLER',
  REMOVE_ABORT_CONTROLLER = 'REMOVE_ABORT_CONTROLLER',
  SET_CANVAS_DATA = 'SET_CANVAS_DATA',
}

// Define action interfaces
interface SetViewingChatAction {
  type: ChatActionType.SET_VIEWING_CHAT;
  payload: { viewingChat: ViewingChat | null };
}

interface SetPendingMessageAction {
  type: ChatActionType.SET_PENDING_MESSAGE;
  payload: { convId: string; pendingMsg: PendingMessage };
}

interface RemovePendingMessageAction {
  type: ChatActionType.REMOVE_PENDING_MESSAGE;
  payload: { convId: string };
}

interface SetAbortControllerAction {
  type: ChatActionType.SET_ABORT_CONTROLLER;
  payload: { convId: string; controller: AbortController };
}

interface RemoveAbortControllerAction {
  type: ChatActionType.REMOVE_ABORT_CONTROLLER;
  payload: { convId: string };
}

interface SetCanvasDataAction {
  type: ChatActionType.SET_CANVAS_DATA;
  payload: { canvasData: CanvasData | null };
}

type ChatAction =
  | SetViewingChatAction
  | SetPendingMessageAction
  | RemovePendingMessageAction
  | SetAbortControllerAction
  | RemoveAbortControllerAction
  | SetCanvasDataAction;

interface ChatState {
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  aborts: Record<Conversation['id'], AbortController>;
  canvasData: CanvasData | null;
}

const initialState: ChatState = {
  viewingChat: null,
  pendingMessages: {},
  aborts: {},
  canvasData: null,
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case ChatActionType.SET_VIEWING_CHAT:
      return {
        ...state,
        viewingChat: action.payload.viewingChat,
      };
    case ChatActionType.SET_PENDING_MESSAGE:
      return {
        ...state,
        pendingMessages: {
          ...state.pendingMessages,
          [action.payload.convId]: action.payload.pendingMsg,
        },
      };
    case ChatActionType.REMOVE_PENDING_MESSAGE: {
      const newPendingMessages = { ...state.pendingMessages };
      delete newPendingMessages[action.payload.convId];
      return {
        ...state,
        pendingMessages: newPendingMessages,
      };
    }
    case ChatActionType.SET_ABORT_CONTROLLER:
      return {
        ...state,
        aborts: {
          ...state.aborts,
          [action.payload.convId]: action.payload.controller,
        },
      };
    case ChatActionType.REMOVE_ABORT_CONTROLLER: {
      const newAborts = { ...state.aborts };
      delete newAborts[action.payload.convId];
      return {
        ...state,
        aborts: newAborts,
      };
    }
    case ChatActionType.SET_CANVAS_DATA:
      return {
        ...state,
        canvasData: action.payload.canvasData,
      };
    default:
      return state;
  }
};

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

const getViewingChat = async (convId: string): Promise<ViewingChat | null> => {
  const conv = await IndexedDB.getOneConversation(convId);
  if (!conv) return null;
  return {
    conv: conv,
    // all messages from all branches, not filtered by last node
    messages: await IndexedDB.getMessages(convId),
  };
};

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatContextProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const params = matchPath('/chat/:convId', pathname);
  const convId = params?.params?.convId;
  const { config } = useAppContext();

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { provider, selectedModel } = useInferenceContext();

  // handle change when the convId from URL is changed
  const handleConversationChange = useCallback(
    async (changedConvId: string) => {
      if (changedConvId !== convId) return;
      dispatch({
        type: ChatActionType.SET_VIEWING_CHAT,
        payload: { viewingChat: await getViewingChat(changedConvId) },
      });
    },
    [convId]
  );

  useEffect(() => {
    // also reset the canvas data
    dispatch({
      type: ChatActionType.SET_CANVAS_DATA,
      payload: { canvasData: null },
    });
    IndexedDB.onConversationChanged(handleConversationChange);
    getViewingChat(convId ?? '').then((viewingChat) =>
      dispatch({
        type: ChatActionType.SET_VIEWING_CHAT,
        payload: { viewingChat },
      })
    );
    return () => {
      IndexedDB.offConversationChanged(handleConversationChange);
    };
  }, [convId, handleConversationChange]);

  const setPending = useCallback(
    (convId: string, pendingMsg: PendingMessage | null) => {
      if (!pendingMsg) {
        dispatch({
          type: ChatActionType.REMOVE_PENDING_MESSAGE,
          payload: { convId },
        });
      } else {
        dispatch({
          type: ChatActionType.SET_PENDING_MESSAGE,
          payload: { convId, pendingMsg },
        });
      }
    },
    []
  );

  const setAbort = useCallback(
    (convId: string, controller: AbortController | null) => {
      if (!controller) {
        dispatch({
          type: ChatActionType.REMOVE_ABORT_CONTROLLER,
          payload: { convId },
        });
      } else {
        dispatch({
          type: ChatActionType.SET_ABORT_CONTROLLER,
          payload: { convId, controller },
        });
      }
    },
    []
  );

  ////////////////////////////////////////////////////////////////////////
  // public functions

  const isGenerating = useCallback(
    (convId: string) => convId in state.pendingMessages,
    [state.pendingMessages]
  );

  const generateMessage = useCallback(
    async ({
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
      if (isGenerating(convId) || !provider) return;

      const currConversation = await IndexedDB.getOneConversation(convId);
      if (!currConversation) {
        throw new Error(t('state.chat.errors.conversationNotFound'));
      }

      const currMessages = IndexedDB.filterByLeafNodeId(
        await IndexedDB.getMessages(convId),
        leafNodeId,
        false
      ).filter((m) => m.role !== 'system');
      const abortController = new AbortController();
      setAbort(convId, abortController);

      if (!currMessages) {
        throw new Error(t('state.chat.errors.messagesNotFound'));
      }

      const messages: InferenceApiMessage[] = normalizeMsgsForAPI(currMessages);
      if (systemMessage) {
        messages.unshift({ role: 'system', content: systemMessage });
      }

      const { model, excludeThoughtOnReq } = config;

      const pendingId = Date.now() + 1;
      let pendingMsg: PendingMessage = {
        id: pendingId,
        convId,
        type: 'text',
        timestamp: pendingId,
        model: selectedModel ? selectedModel.name : model,
        role: 'assistant',
        content: null,
        reasoning_content: null,
        parent: leafNodeId,
        children: [],
      };
      setPending(convId, pendingMsg);

      try {
        const chunks = await provider.postChatCompletions(
          model,
          excludeThoughtOnReq ? filterThoughtFromMsgs(messages) : messages,
          abortController.signal,
          configToCustomOptions(config)
        );
        for await (const chunk of chunks) {
          if (chunk.error) {
            throw new Error(
              chunk.error?.message || t('state.chat.errors.unknownError')
            );
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

          if (chunk.timings) {
            pendingMsg.timings = {
              prompt_n: chunk.timings.prompt_n,
              prompt_ms: chunk.timings.prompt_ms,
              predicted_n: chunk.timings.predicted_n,
              predicted_ms: chunk.timings.predicted_ms,
            };
          } else if (chunk.usage) {
            pendingMsg.timings = {
              prompt_n: chunk.usage.prompt_tokens,
              predicted_n: chunk.usage.completion_tokens,
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
            (err as Error)?.message ??
              t('state.chat.errors.unknownErrorDuringGeneration')
          );
          throw err; // rethrow
        }
      }

      if (pendingMsg.content !== null) {
        await IndexedDB.appendMsg(pendingMsg as Message, leafNodeId);
      }
      setPending(convId, null);
      onChunk(pendingId); // trigger scroll to bottom and switch to the last node
    },
    [config, isGenerating, provider, selectedModel, setAbort, setPending, t]
  );

  const sendMessage = useCallback(
    async ({
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
          await IndexedDB.appendMsg(
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
          toast.error(t('state.chat.errors.cannotSaveMessage'));
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
        toast.error(t('state.chat.errors.failedToGetResponse'));
        // TODO: rollback
      }
      return false;
    },
    [generateMessage, isGenerating, t]
  );

  const stopGenerating = useCallback(
    (convId: string) => {
      setPending(convId, null);
      state.aborts[convId]?.abort();
    },
    [state.aborts, setPending]
  );

  const replaceMessage = useCallback(
    async ({ msg, newContent, onChunk }: ReplaceMessageProps) => {
      if (isGenerating(msg.convId)) return;

      const now = Date.now();
      const currMsgId = now;
      await IndexedDB.appendMsg(
        {
          ...msg,
          id: currMsgId,
          timestamp: now,
          content: newContent,
        },
        msg.parent
      );
      onChunk(currMsgId);
    },
    [isGenerating]
  );

  const branchMessage = useCallback(
    async (msg: Message) => {
      if (isGenerating(msg.convId)) return;

      try {
        const conv = await IndexedDB.branchConversation(msg.convId, msg.id);
        navigate(`/chat/${conv.id}`);
      } catch (error) {
        console.error('Conversation branch failed:', error);
        toast.error(t('state.chat.errors.failedToBranchConversation'));
      }
    },
    [isGenerating, navigate, t]
  );

  const setCanvasData = useCallback((data: CanvasData | null) => {
    dispatch({
      type: ChatActionType.SET_CANVAS_DATA,
      payload: { canvasData: data },
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        viewingChat: state.viewingChat,
        canvasData: state.canvasData,
        pendingMessages: state.pendingMessages,
        isGenerating,
        sendMessage,
        stopGenerating,
        replaceMessage,
        branchMessage,
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
