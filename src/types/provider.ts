import { SpeechCreateParams, SpeechVoice } from './audio';
import { InferenceApiMessage, InferenceApiModel } from './inference';

/**
 * Represents generic data payload structure for Server-Sent Events (SSE).
 * Used as a flexible container for arbitrary key-value pairs in SSE messages.
 * @interface
 */
export interface SSEData {
  [key: string]: unknown;
}

/**
 * Represents a single Server-Sent Event (SSE) message with a defined type and value.
 * This interface conforms to the SSE specification and is used to parse incoming events.
 * @interface
 * @property {('data' | 'error' | 'event' | 'id' | 'retry')} type - The type of SSE event.
 * @property {string} value - The raw string value of the event payload.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
 */
export interface SSEMessage {
  type: 'data' | 'error' | 'event' | 'id' | 'retry';
  value: string;
}

/**
 * Represents a streamed chat completion message from an LLM provider using Server-Sent Events (SSE).
 * This interface extends `SSEData` and includes standardized fields for chat completions.
 * Supports both OpenRouter and llama.cpp formats via optional fields.
 * @interface
 * @extends {SSEData}
 * @property {string} id - Unique identifier for this completion response.
 * @property {string} model - The model name used for generation.
 * @property {string} object - Object type, typically "chat.completion.chunk".
 * @property {number} created - Unix timestamp when the completion was created.
 * @property {Choice[]} [choices] - Array of response choices (delta updates).
 * @property {Error} [error] - Error object if the stream encountered an error.
 * @property {Timings} [timings] - Performance timings from llama.cpp backend.
 * @property {Usage} [usage] - Token usage statistics from OpenRouter backend.
 */
export interface SSEChatCompletionMessage extends SSEData {
  id: string;
  model: string;
  object: string;
  created: number;
  choices?: Choice[];
  error?: Error;
  timings?: Timings;
  usage?: Usage;
}

/**
 * Represents a single choice (response option) in a streaming chat completion.
 * Typically one choice is returned per message in streaming mode.
 * @interface
 * @property {number} index - Zero-based index of this choice.
 * @property {Delta} delta - Incremental update to the response content.
 * @property {string} [finish_reason] - Reason the stream ended (e.g., "stop", "length", "error").
 */
interface Choice {
  index: number;
  delta: Delta;
  finish_reason?: string;
}

/**
 * Represents a partial update (delta) to a message in a streaming chat completion.
 * Contains incremental text or metadata changes from the model.
 * Supports both OpenRouter and llama.cpp-specific fields for reasoning traces.
 * @interface
 * @property {string} [role] - Role of the message sender (e.g., "assistant").
 * @property {string} [content] - Incremental text content added to the response.
 * @property {string} [reasoning] - (OpenRouter) Reasoning trace or chain-of-thought output.
 * @property {string} [reasoning_content] - (llama.cpp) Alternative reasoning content field.
 */
interface Delta {
  role?: string;
  content?: string;
  reasoning?: string;
  reasoning_content?: string;
}

/**
 * Performance timing metrics from the llama.cpp inference engine.
 * Captures latency and throughput statistics for prompt processing and token generation.
 * @interface
 * @property {number} cache_n - Number of cached tokens.
 * @property {number} prompt_n - Number of tokens in the prompt.
 * @property {number} prompt_ms - Time in milliseconds to process the prompt.
 * @property {number} prompt_per_token_ms - Average time per prompt token in milliseconds.
 * @property {number} prompt_per_second - Tokens processed per second during prompt phase.
 * @property {number} predicted_n - Number of tokens generated.
 * @property {number} predicted_ms - Time in milliseconds to generate predicted tokens.
 * @property {number} predicted_per_token_ms - Average time per generated token in milliseconds.
 * @property {number} predicted_per_second - Tokens generated per second.
 */
interface Timings {
  cache_n: number;
  prompt_n: number;
  prompt_ms: number;
  prompt_per_token_ms: number;
  prompt_per_second: number;
  predicted_n: number;
  predicted_ms: number;
  predicted_per_token_ms: number;
  predicted_per_second: number;
}

/**
 * Token usage statistics from OpenRouter API.
 * Reports token consumption for prompt and completion phases.
 * @interface
 * @property {number} prompt_tokens - Number of tokens in the input prompt.
 * @property {number} completion_tokens - Number of tokens in the generated response.
 * @property {number} total_tokens - Sum of prompt and completion tokens.
 */
interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Interface defining the contract for an LLM provider configuration.
 * Provides access to the base URL and API key required for authentication.
 * @interface
 * @method getBaseUrl - Returns the base API endpoint URL.
 * @method getApiKey - Returns the API key for authentication, or undefined if not set.
 */
export interface LLMProvider {
  /**
   * Gets the base URL of the LLM API endpoint.
   * @returns {string} The base URL (e.g., "https://api.openrouter.ai").
   */
  getBaseUrl(): string;

  /**
   * Gets the API key used for authenticating requests.
   * @returns {string | undefined} The API key, or undefined if not configured.
   */
  getApiKey(): string | undefined;
}

/**
 * Interface defining the contract for retrieving available models from an LLM provider.
 * @interface
 * @method getModels - Fetches the list of available models asynchronously.
 * @returns {Promise<InferenceApiModel[]>} A promise resolving to an array of model definitions.
 */
export interface ModelProvider {
  /**
   * Retrieves the list of available models from the provider.
   * @returns {Promise<InferenceApiModel[]>} A promise that resolves to an array of model definitions.
   */
  getModels(): Promise<InferenceApiModel[]>;
}

/**
 * Interface defining the contract for generating streaming chat completions.
 * Supports abort signals and custom options for advanced control.
 * @interface
 * @method postChatCompletions - Sends a chat request and returns a streaming generator.
 * @param {string} model - The model identifier to use (e.g., "openai/gpt-4").
 * @param {readonly InferenceApiMessage[]} messages - The conversation history.
 * @param {AbortSignal} abortSignal - Signal to cancel the request.
 * @param {object} [customOptions] - Optional provider-specific configuration.
 * @returns {Promise<AsyncGenerator<SSEChatCompletionMessage, void, undefined>>} A stream of SSE messages.
 */
export interface ChatCompletionProvider {
  /**
   * Sends a chat completion request and returns a streaming generator of SSE messages.
   * The generator yields partial responses as they arrive from the server.
   * @param {string} model - The model identifier to use for generation.
   * @param {readonly InferenceApiMessage[]} messages - The conversation history as messages.
   * @param {AbortSignal} abortSignal - An AbortSignal to cancel the request if needed.
   * @param {object} [customOptions] - Optional provider-specific parameters (e.g., temperature, max_tokens).
   * @returns {Promise<AsyncGenerator<SSEChatCompletionMessage, void, undefined>>} A stream of incremental chat completion updates.
   * @throws {Error} If the request fails or the model is unavailable.
   */
  postChatCompletions(
    model: string,
    messages: readonly InferenceApiMessage[],
    abortSignal: AbortSignal,
    customOptions?: object
  ): Promise<AsyncGenerator<SSEChatCompletionMessage, void, undefined>>;
}

/**
 * Combined interface that aggregates all required capabilities for a complete inference provider.
 * Extends `LLMProvider`, `ModelProvider`, and `ChatCompletionProvider` to provide a unified API.
 * Implementations should handle model discovery, authentication, and streaming chat completions.
 * @interface
 * @extends {LLMProvider}
 * @extends {ModelProvider}
 * @extends {ChatCompletionProvider}
 */
export interface InferenceProvider
  extends LLMProvider,
    ModelProvider,
    ChatCompletionProvider {}

/**
 * Interface defining the contract for retrieving available text-to-speech voices.
 * @interface
 * @method getVoices - Fetches the list of available speech voices asynchronously.
 * @returns {Promise<SpeechVoice[]>} A promise resolving to an array of voice definitions.
 */
export interface VoiceProvider {
  /**
   * Retrieves the list of available speech voices from the provider.
   * @returns {Promise<SpeechVoice[]>} A promise that resolves to an array of voice definitions.
   */
  getVoices(): Promise<SpeechVoice[]>;
}

/**
 * Interface defining the contract for text-to-speech synthesis.
 * Combines authentication, voice discovery, and audio generation capabilities.
 * @interface
 * @extends {LLMProvider}
 * @extends {ModelProvider}
 * @extends {VoiceProvider}
 * @method postSpeech - Generates audio from text using the specified parameters.
 * @param {SpeechCreateParams} params - Parameters for speech generation (text, voice, speed, etc.).
 * @param {AbortSignal} abortSignal - Signal to cancel the audio generation request.
 * @returns {Promise<Blob>} A promise resolving to the generated audio as a Blob.
 */
export interface TextToSpeechProvider
  extends LLMProvider,
    ModelProvider,
    VoiceProvider {
  /**
   * Generates audio from text using the specified parameters.
   * @param {SpeechCreateParams} params - Configuration for speech synthesis (text, voice, speed, etc.).
   * @param {AbortSignal} abortSignal - Signal to cancel the request if needed.
   * @returns {Promise<Blob>} The generated audio data as a Blob (e.g., MP3 or WAV).
   */
  postSpeech(
    params: SpeechCreateParams,
    abortSignal: AbortSignal
  ): Promise<Blob>;
}
