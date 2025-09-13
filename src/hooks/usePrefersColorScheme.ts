import { useEffect, useState } from 'react';
import { isDev } from '../config';

function usePrefersColorScheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Set initial color scheme
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    // Handle changes to the color scheme
    const handleChange = (e: MediaQueryListEvent) => {
      const newColorScheme = e.matches ? 'dark' : 'light';
      if (isDev) console.debug('Color Scheme changed: ', newColorScheme);
      setColorScheme(newColorScheme);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup the event listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return { colorScheme };
}

export default usePrefersColorScheme;
