import React from 'react';

/**
 * A debounce React hook that creates a debounced version of a callback function.
 *
 * @template T - The type of the callback function to debounce
 *
 * @param callback - The callback function to debounce. This function will be called after the specified delay when no more calls are made.
 * @param delay - The debounce delay in milliseconds. The callback will only be executed after this amount of time has passed without any new calls.
 *
 * @returns A debounced version of the provided callback function. When called multiple times in rapid succession, only the last call will be executed after the specified delay.
 *
 * @example
 * ```typescript
 * const debouncedSearch = useDebouncedCallback((searchTerm: string) => {
 *   // Perform search API call
 *   api.search(searchTerm);
 * }, 300);
 *
 * // In your component:
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
) {
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  };
}
