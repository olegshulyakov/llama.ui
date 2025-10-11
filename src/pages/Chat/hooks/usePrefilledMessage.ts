import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { isDev } from '../../../config';

/**
 * Custom hook to manage prefilled messages from URL query parameters.
 * Looks for 'm' (message) or 'q' (query) parameters.
 * If 'q' is present, the message should be sent immediately.
 */
export function usePrefilledMessage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [prefilledContent, setPrefilledContent] = useState('');
  const [isPrefilledSend, setIsPrefilledSend] = useState(false);

  useEffect(() => {
    const message = searchParams.get('m') || searchParams.get('q') || '';
    const send = searchParams.has('q');
    if (isDev)
      console.debug('usePrefilledMessage', {
        message,
        send,
      });

    setPrefilledContent(message);
    setIsPrefilledSend(send);

    // Clean up URL parameters after reading them
    const cleanedSearchParams = new URLSearchParams(searchParams);
    cleanedSearchParams.delete('m');
    cleanedSearchParams.delete('q');
    setSearchParams(cleanedSearchParams);
  }, [searchParams, setSearchParams]);

  return { prefilledContent, isPrefilledSend };
}
