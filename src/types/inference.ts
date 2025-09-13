import { Message } from './chat';

/**
 * Represents a single content part in an API message, supporting multiple content types
 * including text, images, and audio inputs for multimodal interactions. [[9]]
 */
export type InferenceApiMessageContentPart =
  | {
      /** The content type identifier */
      type: 'text';
      /** The text content */
      text: string;
    }
  | {
      /** The content type identifier */
      type: 'image_url';
      /** Image URL details */
      image_url: { url: string };
    }
  | {
      /** The content type identifier */
      type: 'input_audio';
      /** Audio input details */
      input_audio: { data: string; format: 'wav' | 'mp3' };
    };

/**
 * Represents a message structure compatible with the API endpoint.
 * Can contain either a simple string or an array of content parts for multimodal support. [[4]]
 */
export type InferenceApiMessage = {
  /** The role of the message sender (system, user, assistant) */
  role: Message['role'];
  /** The message content, which can be a string or structured content parts */
  content: string | InferenceApiMessageContentPart[];
};

/**
 * Represents model information returned by the API's models endpoint.
 * Contains basic model metadata that clients might need for display or selection. [[1]]
 */
export type InferenceApiModel = {
  /** Unique model identifier */
  id: string;
  /** User-friendly model name (optional) */
  name: string;
  /** Model description (optional) */
  description?: string;
  /** Timestamp of model creation (optional) */
  created?: number;
};

/**
 * Interface representing server properties from a Llama.cpp server instance.
 * Contains essential information about the server configuration and capabilities. [[9]]
 */
export interface LlamaCppServerProps {
  /** Build information of the server */
  build_info: string;
  /** Currently loaded model name/path */
  model: string;
  /** Maximum context length supported by the model */
  n_ctx: number;
  /** Modality support information for the model */
  modalities?: {
    /** Whether vision capabilities are supported */
    vision: boolean;
    /** Whether audio capabilities are supported */
    audio: boolean;
  };
  // TODO: support params
}
