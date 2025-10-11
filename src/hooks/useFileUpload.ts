import * as pdfjs from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../store/app';
import { useInferenceContext } from '../store/inference';
import { MessageExtra } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

/**
 * This file handles uploading extra context items (a.k.a files)
 * It allows processing these kinds of files:
 * - image files (converted to base64)
 * - audio files (converted to base64)
 * - text files (including code files)
 * - pdf (converted to text)
 */

/**
 * Interface describing the API returned by the useFileUpload hook
 */
export interface FileUploadApi {
  /** Array of uploaded files/items, undefined if empty */
  items?: MessageExtra[];

  /** Adds new items to the upload list */
  addItems: (items: MessageExtra[]) => void;

  /** Removes an item at the specified index */
  removeItem: (idx: number) => void;

  /** Clears all items from the upload list */
  clearItems: () => void;

  /** Handles file uploads and processes them based on type */
  onFileAdded: (files: File[]) => void;
}

/**
 * Custom React hook for handling file uploads and processing various file types
 *
 * @remarks
 * This hook supports processing of:
 * - Image files (converted to base64)
 * - Audio files (converted to base64)
 * - Text files (including code files)
 * - PDF files (converted to text or images based on configuration)
 *
 * @param initialItems - Initial array of MessageExtra items to pre-populate the hook
 * @returns FileUploadApi object with methods and state for file upload management
 */
export function useFileUpload(
  initialItems: MessageExtra[] = []
): FileUploadApi {
  const { t } = useTranslation();
  const {
    config: { pdfAsImage },
  } = useAppContext();
  const { selectedModel } = useInferenceContext();
  const [items, setItems] = useState<MessageExtra[]>(initialItems);

  const addItems = (newItems: MessageExtra[]) => {
    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearItems = () => {
    setItems([]);
  };

  const isSupportVision = selectedModel?.modalities?.includes('image');

  const onFileAdded = async (files: File[]) => {
    try {
      for (const file of files) {
        const mimeType = file.type;

        // this limit is only to prevent accidental uploads of huge files
        // it can potentially crashes the browser because we read the file as base64
        if (file.size > 500 * 1024 * 1024) {
          toast.error(t('fileUpload.errors.fileTooLarge'));
          break;
        }

        if (mimeType.startsWith('image/')) {
          if (!isSupportVision) {
            toast.error(t('fileUpload.errors.multimodalNotSupported'));
            break;
          }

          let base64Url = await getFileAsBase64(file, true, t);
          if (mimeType === 'image/svg+xml') {
            // Convert SVG to PNG
            base64Url = await svgBase64UrlToPngDataURL(base64Url, t);
          }
          addItems([
            {
              type: 'imageFile',
              name: file.name,
              base64Url,
            },
          ]);
        } else if (mimeType.startsWith('video/')) {
          toast.error(t('fileUpload.errors.videoNotSupported'));
          break;
        } else if (mimeType.startsWith('audio/')) {
          if (!/mpeg|wav/.test(mimeType)) {
            toast.error(t('fileUpload.errors.audioNotSupported'));
            break;
          }

          // plain base64, not a data URL
          const base64Data = await getFileAsBase64(file, false, t);
          addItems([
            {
              type: 'audioFile',
              name: file.name,
              mimeType,
              base64Data,
            },
          ]);
        } else if (mimeType.startsWith('application/pdf')) {
          if (pdfAsImage && !isSupportVision) {
            toast(t('fileUpload.errors.pdfMultimodalNotSupported'));
            break;
          }

          if (pdfAsImage && isSupportVision) {
            // Convert PDF to images
            const base64Urls = await convertPDFToImage(file, t);
            addItems(
              base64Urls.map((base64Url) => ({
                type: 'imageFile',
                name: file.name,
                base64Url,
              }))
            );
          } else {
            // Convert PDF to text
            const content = await convertPDFToText(file, t);
            addItems([
              {
                type: 'textFile',
                name: file.name,
                content,
              },
            ]);
            if (isSupportVision) {
              toast.success(t('fileUpload.notifications.pdfConvertedToText'));
            }
          }
          break;
        } else {
          // Because there can be many text file types (like code file), we will not check the mime type
          // and will just check if the file is not binary.
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const content = event.target.result as string;
              if (!isLikelyNotBinary(content)) {
                toast.error(t('fileUpload.errors.fileIsBinary'));
                return;
              }
              addItems([
                {
                  type: 'textFile',
                  name: file.name,
                  content,
                },
              ]);
            }
          };
          reader.readAsText(file);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorMessage = t('fileUpload.errorProcessingFile', {
        message,
      });
      toast.error(errorMessage);
    }
  };

  return {
    items: items.length > 0 ? items : undefined,
    addItems,
    removeItem,
    clearItems,
    onFileAdded,
  };
}

/**
 * Reads a file and returns it as a base64 string or data URL
 *
 * @param file - The file to read
 * @param outputUrl - Whether to output as data URL (true) or plain base64 (false)
 * @param t - Translation function
 * @returns Promise resolving to the base64 string or data URL
 */
async function getFileAsBase64(
  file: File,
  outputUrl = true,
  t: ReturnType<typeof useTranslation>['t']
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        let result = event.target.result as string;
        if (!outputUrl) {
          // remove base64 url prefix and correct characters
          result = result.substring(result.indexOf(',') + 1);
        }
        resolve(result);
      } else {
        reject(new Error(t('fileUpload.errors.failedToReadFile')));
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a file and returns it as an ArrayBuffer
 *
 * @param file - The file to read
 * @param t - Translation function
 * @returns Promise resolving to the ArrayBuffer
 */
async function getFileAsBuffer(
  file: File,
  t: ReturnType<typeof useTranslation>['t']
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as ArrayBuffer);
      } else {
        reject(new Error(t('fileUpload.errors.failedToReadFile')));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Converts a PDF file to text content
 *
 * @param file - The PDF file to convert
 * @param t - Translation function
 * @returns Promise resolving to the extracted text content
 */
async function convertPDFToText(
  file: File,
  t: ReturnType<typeof useTranslation>['t']
): Promise<string> {
  const buffer = await getFileAsBuffer(file, t);
  const pdf = await pdfjs.getDocument(buffer).promise;
  const numPages = pdf.numPages;
  const textContentPromises: Promise<TextContent>[] = [];
  for (let i = 1; i <= numPages; i++) {
    textContentPromises.push(
      pdf.getPage(i).then((page) => page.getTextContent())
    );
  }
  const textContents = await Promise.all(textContentPromises);
  const textItems = textContents.flatMap((textContent: TextContent) =>
    textContent.items.map((item) => (item as TextItem).str ?? '')
  );
  return textItems.join('\n');
}

/**
 * Converts a PDF file to an array of base64 image data URLs
 *
 * @param file - The PDF file to convert
 * @param t - Translation function
 * @returns Promise resolving to an array of base64 image data URLs
 */
async function convertPDFToImage(
  file: File,
  t: ReturnType<typeof useTranslation>['t']
): Promise<string[]> {
  const buffer = await getFileAsBuffer(file, t);
  const doc = await pdfjs.getDocument(buffer).promise;
  const pages: Promise<string>[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    if (!ctx) {
      throw new Error(t('fileUpload.errors.failedToGetCanvasContext'));
    }
    const task = page.render({ canvasContext: ctx, viewport: viewport });
    pages.push(
      task.promise.then(() => {
        return canvas.toDataURL();
      })
    );
  }

  return await Promise.all(pages);
}

/**
 * Heuristic function to determine if a string is likely not binary
 *
 * @remarks
 * This is a heuristic approach to detect binary files by checking for:
 * - Unicode Replacement Characters (U+FFFD)
 * - Null bytes (U+0000)
 * - C0 Control Characters (excluding common text controls)
 *
 * @param str - The string to check
 * @returns Boolean indicating if the string is likely not binary
 */
function isLikelyNotBinary(str: string): boolean {
  const options = {
    prefixLength: 1024 * 10, // Check the first 10KB of the string
    suspiciousCharThresholdRatio: 0.15, // Allow up to 15% suspicious chars
    maxAbsoluteNullBytes: 2,
  };

  if (!str) {
    return true; // Empty string is considered "not binary" or trivially text.
  }

  const sampleLength = Math.min(str.length, options.prefixLength);
  if (sampleLength === 0) {
    return true; // Effectively an empty string after considering prefixLength.
  }

  let suspiciousCharCount = 0;
  let nullByteCount = 0;

  for (let i = 0; i < sampleLength; i++) {
    const charCode = str.charCodeAt(i);

    // 1. Check for Unicode Replacement Character (U+FFFD)
    // This is a strong indicator if the string was created from decoding bytes as UTF-8.
    if (charCode === 0xfffd) {
      suspiciousCharCount++;
      continue;
    }

    // 2. Check for Null Bytes (U+0000)
    if (charCode === 0x0000) {
      nullByteCount++;
      // We also count nulls towards the general suspicious character count,
      // as they are less common in typical text files.
      suspiciousCharCount++;
      continue;
    }

    // 3. Check for C0 Control Characters (U+0001 to U+001F)
    // Exclude common text control characters: TAB (9), LF (10), CR (13).
    // We can also be a bit lenient with BEL (7) and BS (8) which sometimes appear in logs.
    if (charCode < 32) {
      if (
        charCode !== 9 && // TAB
        charCode !== 10 && // LF
        charCode !== 13 && // CR
        charCode !== 7 && // BEL (Bell) - sometimes in logs
        charCode !== 8 // BS (Backspace) - less common, but possible
      ) {
        suspiciousCharCount++;
      }
    }
    // Characters from 32 (space) up to 126 (~) are printable ASCII.
    // Characters 127 (DEL) is a control character.
    // Characters >= 128 are extended ASCII / multi-byte Unicode.
    // If they resulted in U+FFFD, we caught it. Otherwise, they are valid
    // (though perhaps unusual) Unicode characters from JS's perspective.
    // The main concern is if those higher characters came from misinterpreting
    // a single-byte encoding as UTF-8, which again, U+FFFD would usually flag.
  }

  // Check absolute null byte count
  if (nullByteCount > options.maxAbsoluteNullBytes) {
    return false; // Too many null bytes is a strong binary indicator
  }

  // Check ratio of suspicious characters
  const ratio = suspiciousCharCount / sampleLength;
  return ratio <= options.suspiciousCharThresholdRatio;
}

/**
 * Converts a Base64URL encoded SVG string to a PNG Data URL using browser Canvas API
 *
 * @param base64UrlSvg - Base64 encoded SVG data URL
 * @param t - Translation function
 * @returns Promise resolving to PNG data URL
 */
function svgBase64UrlToPngDataURL(
  base64UrlSvg: string,
  t: ReturnType<typeof useTranslation>['t']
): Promise<string> {
  const backgroundColor = 'white'; // Default background color for PNG

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error(t('fileUpload.errors.failedToGetCanvasContext')));
          return;
        }

        // Use provided dimensions or SVG's natural dimensions, with fallbacks
        // Fallbacks (e.g., 300x300) are for SVGs without explicit width/height
        // or when naturalWidth/Height might be 0 before full processing.
        const targetWidth = img.naturalWidth || 300;
        const targetHeight = img.naturalHeight || 300;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        if (backgroundColor) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        reject(new Error(t('fileUpload.errors.failedToLoadSvg')));
      };

      // Load SVG string into an Image element
      img.src = base64UrlSvg;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorMessage = t('fileUpload.errorConvertingSvg', {
        message,
      });
      toast.error(errorMessage);
      reject(new Error(errorMessage));
    }
  });
}
