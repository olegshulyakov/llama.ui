import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ChatInput } from '../components/ChatInput';
import { useAppContext } from '../context/app';
import { CallbackGeneratedChunk, useChatContext } from '../context/chat';
import StorageUtils from '../database';
import * as lang from '../lang/en.json';
import { MessageExtra } from '../types';
import { getUniqueRandomElements } from '../utils';

const SAMPLE_PROMPTS_COUNT = 4;

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const {
    config: { systemMessage },
  } = useAppContext();
  const { sendMessage } = useChatContext();

  const handleSend = useCallback(
    async (content: string, extra: MessageExtra[] | undefined) => {
      const conv = await StorageUtils.createConversation(
        content.substring(0, 256)
      );
      // if user is creating a new conversation, redirect to the new conversation
      await navigate(`/chat/${conv.id}`);
      const onChunk: CallbackGeneratedChunk = (_) => {};
      return sendMessage({
        convId: conv.id,
        type: 'text',
        role: 'user',
        parent: conv.currNode,
        content,
        extra,
        system: systemMessage,
        onChunk,
      });
    },
    [systemMessage, navigate, sendMessage]
  );

  return (
    <div className="flex flex-col h-full w-full xl:max-w-[900px] mx-auto">
      <div className="grow flex flex-col items-center justify-center px-2 transition-[300ms]">
        <h1 className="text-4xl font-medium">{lang.chatScreen.welcome}</h1>
        <small>{lang.chatScreen.welcomeNote}</small>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-5/6 sm:max-w-3/4 mt-8">
          {getUniqueRandomElements(
            lang.samplePrompts,
            SAMPLE_PROMPTS_COUNT
          ).map((text) => (
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

      {/* chat input */}
      <ChatInput onSend={handleSend} onStop={() => {}} isGenerating={false} />
    </div>
  );
}
