import { useCallback, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '../../components';
import IndexedDB from '../../database/indexedDB';
import { useAppContext } from '../../store/app';
import { CallbackGeneratedChunk, useChatContext } from '../../store/chat';
import { MessageExtra } from '../../types';
import { getUniqueRandomElements } from '../../utils';
import { ChatInput } from '../Chat/components/ChatInput';

const SAMPLE_PROMPTS_COUNT = 4;

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    config: { systemMessage },
  } = useAppContext();
  const { sendMessage } = useChatContext();
  const samplePrompts = useMemo(
    () =>
      getUniqueRandomElements(
        t('samplePrompts', { returnObjects: true }) as string[],
        SAMPLE_PROMPTS_COUNT
      ),
    [t]
  );

  const handleSend = useCallback(
    async (content: string, extra: MessageExtra[] | undefined) => {
      const conv = await IndexedDB.createConversation(
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
        <h1 className="text-4xl font-medium">
          <Trans i18nKey="welcomeScreen.welcome" />
        </h1>
        <small>
          <Trans i18nKey="welcomeScreen.welcomeNote" />
        </small>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-5/6 sm:max-w-3/4 mt-8">
          {samplePrompts.map((text) => (
            <Button
              key={text}
              className="h-auto bg-base-200 font-medium rounded-xl p-2"
              onClick={() => {
                navigate(`/chat?q=${encodeURIComponent(text)}`, {});
              }}
            >
              {text}
            </Button>
          ))}
        </div>
      </div>

      {/* chat input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
}
