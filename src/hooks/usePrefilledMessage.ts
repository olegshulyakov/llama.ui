import { useEffect, useState } from 'react';
import { cleanCurrentUrl } from '../utils';

/**
 * Custom hook to manage prefilled messages from URL query parameters.
 * Looks for 'm' (message) or 'q' (query) parameters.
 * If 'q' is present, the message should be sent immediately.
 */
export function usePrefilledMessage() {
  const [prefilledContent, setPrefilledContent] = useState('');
  const [shouldSendPrefilled, setShouldSendPrefilled] = useState(false);

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const message = searchParams.get('m') || searchParams.get('q') || '';
    const send = searchParams.has('q');

    setPrefilledContent(message);
    setShouldSendPrefilled(send);

    // Clean up URL parameters after reading them
    cleanCurrentUrl(['m', 'q']);
  }, []); // Run only once on mount

  return { prefilledContent, shouldSendPrefilled };
}
