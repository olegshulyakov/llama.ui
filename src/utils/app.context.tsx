import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { isDev } from '../config';
import {
  filterThoughtFromMsgs,
  getSSEStreamAsync,
  getServerProps,
  normalizeMsgsForAPI,
} from './misc';
import StorageUtils from './storage';
import {
  APIMessage,
  CanvasData,
  Configuration,
  Conversation,
  LlamaCppServerProps,
  Message,
  MessageExtra,
  PendingMessage,
  ViewingChat,
} from './types';

interface AppContextValue {
  // conversations and messages
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  isGenerating: (convId: string) => boolean;
  sendMessage: (
    convId: string | null,
    leafNodeId: Message['id'] | null,
    content: string,
    extra: Message['extra'],
    onChunk: CallbackGeneratedChunk
  ) => Promise<boolean>;
  stopGenerating: (convId: string) => void;
  replaceMessage: (
    convId: string,
    msg: Message,
    content: string | null,
    onChunk: CallbackGeneratedChunk
  ) => Promise<void>;
  replaceMessageAndGenerate: (
    convId: string,
    msg: Message, // the parent node of the message to be replaced
    content: string | null,
    extra: MessageExtra[] | undefined,
    onChunk: CallbackGeneratedChunk
  ) => Promise<void>;

  // canvas
  canvasData: CanvasData | null;
  setCanvasData: (data: CanvasData | null) => void;

  // config
  config: Configuration;
  saveConfig: (config: Configuration) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  // props
  serverProps: LlamaCppServerProps | null;
}

// this callback is used for scrolling to the bottom of the chat and switching to the last node
export type CallbackGeneratedChunk = (currLeafNodeId?: Message['id']) => void;

const AppContext = createContext<AppContextValue>({
  viewingChat: null,
  pendingMessages: {},
  isGenerating: () => false,
  sendMessage: async () => false,
  stopGenerating: () => {},
  replaceMessage: async () => {},
  replaceMessageAndGenerate: async () => {},
  canvasData: null,
  setCanvasData: () => {},
  config: {} as Configuration,
  saveConfig: () => {},
  showSettings: false,
  setShowSettings: () => {},
  serverProps: null,
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

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactElement;
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const params = matchPath('/chat/:convId', pathname);
  const convId = params?.params?.convId;

  const [serverProps, setServerProps] = useState<LlamaCppServerProps | null>(
    null
  );
  const [viewingChat, setViewingChat] = useState<ViewingChat | null>(null);
  const [pendingMessages, setPendingMessages] = useState<
    Record<Conversation['id'], PendingMessage>
  >({});
  const [aborts, setAborts] = useState<
    Record<Conversation['id'], AbortController>
  >({});
  const [config, setConfig] = useState(StorageUtils.getConfig());
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // get server props
  useEffect(() => {
    getServerProps(config.baseUrl, config.apiKey)
      .then((props) => {
        setServerProps(props);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to fetch server props');
      });
    // eslint-disable-next-line
  }, []);

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

  const generateMessage = async (
    convId: string,
    leafNodeId: Message['id'],
    onChunk: CallbackGeneratedChunk
  ) => {
    if (isGenerating(convId)) return;

    const config = StorageUtils.getConfig();
    const currConversation = await StorageUtils.getOneConversation(convId);
    if (!currConversation) {
      throw new Error('Current conversation is not found');
    }

    const currMessages = StorageUtils.filterByLeafNodeId(
      await StorageUtils.getMessages(convId),
      leafNodeId,
      false
    );
    const abortController = new AbortController();
    setAbort(convId, abortController);

    if (!currMessages) {
      throw new Error('Current messages are not found');
    }

    const pendingId = Date.now() + 1;
    let pendingMsg: PendingMessage = {
      id: pendingId,
      convId,
      type: 'text',
      timestamp: pendingId,
      role: 'assistant',
      content: null,
      parent: leafNodeId,
      children: [],
    };
    setPending(convId, pendingMsg);

    try {
      // prepare messages for API
      let messages: APIMessage[] = [
        ...(config.systemMessage.length === 0
          ? []
          : [{ role: 'system', content: config.systemMessage } as APIMessage]),
        ...normalizeMsgsForAPI(currMessages),
      ];
      if (config.excludeThoughtOnReq) {
        messages = filterThoughtFromMsgs(messages);
      }
      if (isDev) console.debug({ messages });

      // prepare params
      let params = {
        messages,
        stream: true,
        cache_prompt: true,
        timings_per_token: !!config.showTokensPerSecond,
      };

      // advanced options
      if (config.overrideGenerationOptions)
        params = Object.assign(params, {
          temperature: config.temperature,
          top_k: config.top_k,
          top_p: config.top_p,
          min_p: config.min_p,
          max_tokens: config.max_tokens,
        });

      if (config.overrideSamplersOptions)
        params = Object.assign(params, {
          samplers: config.samplers,
          dynatemp_range: config.dynatemp_range,
          dynatemp_exponent: config.dynatemp_exponent,
          typical_p: config.typical_p,
          xtc_probability: config.xtc_probability,
          xtc_threshold: config.xtc_threshold,
        });

      if (config.overridePenaltyOptions)
        params = Object.assign(params, {
          repeat_last_n: config.repeat_last_n,
          repeat_penalty: config.repeat_penalty,
          presence_penalty: config.presence_penalty,
          frequency_penalty: config.frequency_penalty,
          dry_multiplier: config.dry_multiplier,
          dry_base: config.dry_base,
          dry_allowed_length: config.dry_allowed_length,
          dry_penalty_last_n: config.dry_penalty_last_n,
        });

      if (config.custom.trim().length)
        params = Object.assign(params, JSON.parse(config.custom));

      // send request
      const fetchResponse = await fetch(
        `${config.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey
              ? { Authorization: `Bearer ${config.apiKey}` }
              : {}),
          },
          body: JSON.stringify(params),
          signal: abortController.signal,
        }
      );
      if (fetchResponse.status !== 200) {
        const body = await fetchResponse.json();
        throw new Error(body?.error?.message || 'Unknown error');
      }
      const chunks = getSSEStreamAsync(fetchResponse);
      for await (const chunk of chunks) {
        // const stop = chunk.stop;
        if (chunk.error) {
          throw new Error(chunk.error?.message || 'Unknown error');
        }
        const addedContent = chunk.choices[0].delta.content;
        if (addedContent) {
          const lastContent = pendingMsg.content || '';
          pendingMsg = {
            ...pendingMsg,
            content: lastContent + addedContent,
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
        onChunk(); // don't need to switch node for pending message
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

  const sendMessage = async (
    convId: string | null,
    leafNodeId: Message['id'] | null,
    content: string,
    extra: Message['extra'],
    onChunk: CallbackGeneratedChunk
  ): Promise<boolean> => {
    if (isGenerating(convId ?? '') || content.trim().length === 0) return false;

    if (convId === null || convId.length === 0 || leafNodeId === null) {
      const conv = await StorageUtils.createConversation(
        content.substring(0, 256)
      );
      convId = conv.id;
      leafNodeId = conv.currNode;
      // if user is creating a new conversation, redirect to the new conversation
      navigate(`/chat/${convId}`);
    }

    const now = Date.now();
    const currMsgId = now;
    StorageUtils.appendMsg(
      {
        id: currMsgId,
        timestamp: now,
        type: 'text',
        convId,
        role: 'user',
        content,
        extra,
        parent: leafNodeId,
        children: [],
      },
      leafNodeId
    );
    onChunk(currMsgId);

    try {
      await generateMessage(convId, currMsgId, onChunk);
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

  const replaceMessage = async (
    convId: string,
    msg: Message,
    content: string | null,
    onChunk: CallbackGeneratedChunk
  ) => {
    if (isGenerating(convId)) return;

    if (content == null) {
      onChunk(msg.parent);
      return;
    }

    const now = Date.now();
    const currMsgId = now;
    StorageUtils.appendMsg(
      {
        id: currMsgId,
        timestamp: now,
        type: msg.type,
        convId,
        role: msg.role,
        content,
        extra: msg.extra,
        parent: msg.parent,
        children: [],
      },
      msg.parent
    );
    onChunk(currMsgId);
  };

  // if content is null, we remove last assistant message
  const replaceMessageAndGenerate = async (
    convId: string,
    msg: Message,
    content: string | null,
    extra: MessageExtra[] | undefined,
    onChunk: CallbackGeneratedChunk
  ) => {
    if (isGenerating(convId)) return;

    let parentNodeId = msg.parent;
    if (content !== null) {
      const now = Date.now();
      const currMsgId = now;
      StorageUtils.appendMsg(
        {
          id: currMsgId,
          timestamp: now,
          type: msg.type,
          convId,
          role: msg.role,
          content,
          extra,
          parent: parentNodeId,
          children: [],
        },
        parentNodeId
      );
      parentNodeId = currMsgId;
    }
    onChunk(parentNodeId);

    await generateMessage(convId, parentNodeId, onChunk);
  };

  const saveConfig = (config: Configuration) => {
    StorageUtils.setConfig(config);
    setConfig(config);
  };

  return (
    <AppContext.Provider
      value={{
        isGenerating,
        viewingChat,
        pendingMessages,
        sendMessage,
        stopGenerating,
        replaceMessage,
        replaceMessageAndGenerate,
        canvasData,
        setCanvasData,
        config,
        saveConfig,
        showSettings,
        setShowSettings,
        serverProps,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
