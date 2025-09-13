/**
 * Checks if a value is a string by verifying it has a `toLowerCase` method.
 * Note: This is a heuristic check and may produce false positives for objects
 * that have a `toLowerCase` property but aren't actually strings.
 *
 * @param x - The value to check
 * @returns `true` if the value appears to be a string, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isString = (x: any) => !!x.toLowerCase;

/**
 * Checks if a value is a boolean by comparing it to `true` and `false`.
 *
 * @param x - The value to check
 * @returns `true` if the value is strictly equal to `true` or `false`, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBoolean = (x: any) => x === true || x === false;

/**
 * Checks if a value is numeric by ensuring it's not a string, not a boolean,
 * and can be converted to a number without resulting in NaN.
 *
 * @param n - The value to check
 * @returns `true` if the value appears to be numeric, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNumeric = (n: any) => !isString(n) && !isNaN(n) && !isBoolean(n);

/**
 * Escapes HTML attribute values by replacing special characters with their HTML entities.
 * Specifically replaces `>` with `&gt;` and `"` with `&quot;`.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in HTML attributes
 */
export const escapeAttr = (str: string) =>
  str.replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Copies text to the clipboard using the modern Clipboard API when available,
 * or falls back to the legacy `execCommand` method for older browsers or insecure contexts.
 *
 * @param textToCopy - The text to copy to the clipboard
 */
export const copyStr = (textToCopy: string) => {
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy);
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    // Move textarea out of the viewport so it's not visible
    textArea.style.position = 'absolute';
    textArea.style.left = '-999999px';
    document.body.prepend(textArea);
    textArea.select();
    document.execCommand('copy');
  }
};

/**
 * Generates a space-separated class string from an object where keys are class names
 * and values are boolean flags indicating whether to include the class.
 *
 * @param classes - An object mapping class names to boolean inclusion flags
 * @returns A space-separated string of class names that had truthy values
 */
export function classNames(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([_, value]) => value)
    .map(([key, _]) => key)
    .join(' ');
}

/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * Useful for creating artificial delays in async functions.
 *
 * @param ms - The number of milliseconds to delay
 * @returns A promise that resolves after the specified delay
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a throttled function that only invokes the callback at most once
 * per specified delay period. Subsequent calls within the delay period are ignored.
 *
 * @template T - The argument types of the callback function
 * @param callback - The function to throttle
 * @param delay - The throttle delay in milliseconds
 * @returns A throttled version of the callback function
 */
export const throttle = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  let isWaiting = false;

  return (...args: T) => {
    if (isWaiting) {
      return;
    }

    callback(...args);
    isWaiting = true;

    setTimeout(() => {
      isWaiting = false;
    }, delay);
  };
};

/**
 * Removes specified query parameters from the current URL and updates the browser history.
 *
 * @param removeQueryParams - An array of query parameter names to remove from the current URL
 */
export const cleanCurrentUrl = (removeQueryParams: string[]) => {
  const url = new URL(window.location.href);
  removeQueryParams.forEach((param) => {
    url.searchParams.delete(param);
  });
  window.history.replaceState({}, '', url.toString());
};

/**
 * Normalizes a URL by combining a base URL with a path, ensuring proper slash handling.
 *
 * This function removes trailing slashes from the base URL, ensures the path starts with
 * a single slash, and removes any trailing slashes from the final path component.
 *
 * @param path - The path to append (e.g., '/v1/models' or 'v1/models')
 * @param base - The base URL (e.g., 'https://api.example.com' or 'https://example.com/api/')
 * @returns The normalized URL with proper slash formatting
 */
export function normalizeUrl(path: string, base: string) {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = '/' + path.replace(/^\/+|\/+$/g, '');
  return cleanBase + (cleanPath === '/' ? '' : cleanPath);
}

/**
 * Splits message content into actual content and reasoning content by parsing think tags.
 *
 * @param content - The text to parse
 * @returns An object mapping content and reasoning
 */
export const splitMessageContent = (content: string | null) => {
  if (content == null || content.trim().length === 0) return { content };

  const REGEX_THINK_OPEN = /<think>|<\|channel\|>analysis<\|message\|>/;
  const REGEX_THINK_CLOSE =
    /<\/think>|<\|start\|>assistant<\|channel\|>final<\|message\|>/;

  let actualContent = '';
  let thought = '';
  let thinkSplit = content.split(REGEX_THINK_OPEN, 2);
  actualContent += thinkSplit[0];
  while (thinkSplit[1] !== undefined) {
    // <think> tag found
    thinkSplit = thinkSplit[1].split(REGEX_THINK_CLOSE, 2);
    thought += thinkSplit[0];
    if (thinkSplit[1] !== undefined) {
      // </think> closing tag found
      thinkSplit = thinkSplit[1].split(REGEX_THINK_OPEN, 2);
      actualContent += thinkSplit[0];
    }
  }
  return { content: actualContent, reasoning_content: thought };
};

/**
 * Selects unique random elements from an array without repetition.
 * If the requested count exceeds the array length, returns the entire array.
 *
 * @param array - The array to select elements from
 * @param count - The number of unique random elements to select (default: 4)
 * @returns An array of unique randomly selected elements
 */
export function getUniqueRandomElements(array: string[], count: number = 4) {
  if (count > array.length) {
    return [...array];
  }

  const arrCopy = [...array];
  const result = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * arrCopy.length);
    result.push(arrCopy.splice(randomIndex, 1)[0]);
  }
  return result;
}

/**
 * Performs a deep equality comparison between two objects.
 * Recursively compares all properties and nested objects/arrays.
 *
 * @param obj1 - The first object to compare
 * @param obj2 - The second object to compare
 * @returns `true` if the objects are deeply equal, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepEqual(obj1: any, obj2: any) {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * A language-sensitive formatter for both date and time information.
 *
 * @example
 * const date = new Date();
 * dateFormatter.format(date); // Returns localized short date + time
 */
export const dateFormatter = new Intl.DateTimeFormat(
  Intl.DateTimeFormat().resolvedOptions().locale,
  {
    dateStyle: 'short',
    timeStyle: 'short',
  }
);

/**
 * A language-sensitive formatter for time information only.
 *
 * @example
 * const date = new Date();
 * timeFormatter.format(date); // Returns localized short time
 */
export const timeFormatter = new Intl.DateTimeFormat(
  Intl.DateTimeFormat().resolvedOptions().locale,
  {
    timeStyle: 'short',
  }
);
