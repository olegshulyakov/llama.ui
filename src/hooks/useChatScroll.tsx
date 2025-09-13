import React, { useCallback, useEffect } from 'react';

const TO_BOTTOM = 250;
const DELAY = 50;

export function useChatScroll(msgListRef: React.RefObject<HTMLDivElement>) {
  const scrollToBottom = useCallback(
    (immediate: boolean = false, delay: number = DELAY) => {
      const element = msgListRef?.current;
      if (!element) return;

      if (immediate) {
        setTimeout(
          () =>
            element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }),
          delay
        );
        return;
      }

      const { scrollHeight, scrollTop, clientHeight } = element;
      const spaceToBottom = scrollHeight - scrollTop - clientHeight;
      if (spaceToBottom < TO_BOTTOM) {
        element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
      }
    },
    [msgListRef]
  );

  useEffect(() => {
    const element = msgListRef?.current;
    if (!element) return;

    const observer = new MutationObserver(() => {
      scrollToBottom(false, 0);
    });

    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [msgListRef, scrollToBottom]);

  return { scrollToBottom };
}
