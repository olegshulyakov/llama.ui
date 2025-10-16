import { isDev } from '../../config';
import {
  ChatCompletionProvider,
  InferenceApiMessage,
  InferenceApiModel,
  LLMProvider,
  ModelProvider,
  SSEChatCompletionMessage,
  TextToSpeechProvider,
  VoiceProvider,
} from '../../types';
import { SpeechCreateParams, SpeechVoice } from '../../types/audio';
import { normalizeUrl } from '../../utils';
import { noResponse, processSSEStream } from '../utils';

/**
 * Base implementation for OpenAI-compatible API providers.
 *
 * This class provides a foundational implementation for interacting with
 * OpenAI-compatible inference APIs (e.g., Ollama, vLLM, LocalAI) that expose
 * `/v1/models` and `/v1/chat/completions` endpoints.
 *
 * It handles:
 * - Authentication via Bearer token
 * - Model list caching with expiration
 * - Error response parsing and throwing
 * - Streaming chat completion via Server-Sent Events (SSE)
 * - Header normalization and URL sanitization
 *
 * @example
 * ```ts
 * const provider = BaseOpenAIProvider.new('http://localhost:11434', 'sk-...');
 * const models = await provider.getModels();
 * const stream = await provider.postChatCompletions(
 *   'llama3',
 *   [{ role: 'user', content: 'Hello!' }],
 *   abortSignal
 * );
 * ```
 */
export class BaseOpenAIProvider
  implements
    LLMProvider,
    ModelProvider,
    ChatCompletionProvider,
    VoiceProvider,
    TextToSpeechProvider
{
  /**
   * The base URL of the OpenAI-compatible API endpoint.
   * @internal
   */
  private baseUrl: string;

  /**
   * The API key used for authentication.
   * @internal
   */
  private apiKey: string;

  /**
   * Cached list of available models fetched from the API.
   * @internal
   */
  private models: InferenceApiModel[] = [];

  /**
   * Timestamp of the last successful model list fetch.
   * Used to determine cache expiration (5 minutes).
   * @internal
   */
  protected lastUpdatedModels: number;

  /**
   * Cached list of available voices fetched from the API.
   * @internal
   */
  private voices: SpeechVoice[] = [];

  /**
   * Timestamp of the last successful voice list fetch.
   * Used to determine cache expiration (5 minutes).
   * @internal
   */
  protected lastUpdatedVoices: number;

  /**
   * Constructs a new BaseOpenAIProvider instance.
   *
   * @param baseUrl - The base URL of the API endpoint (e.g., `http://localhost:11434`)
   * @param apiKey - Optional API key for authentication (Bearer token)
   * @throws {Error} If `baseUrl` is not provided or is empty
   *
   * @protected
   */
  protected constructor(baseUrl?: string, apiKey: string = '') {
    if (!baseUrl) throw new Error(`Base URL is not specified`);
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.lastUpdatedModels = 0;
    this.lastUpdatedVoices = 0;
  }

  /**
   * Factory method to create a new BaseOpenAIProvider instance.
   *
   * @param baseUrl - The base URL of the API endpoint
   * @param apiKey - Optional API key for authentication
   * @returns A new instance of BaseOpenAIProvider
   *
   * @static
   */
  static new(baseUrl?: string, apiKey: string = '') {
    return new BaseOpenAIProvider(baseUrl, apiKey);
  }

  /**
   * Retrieves the list of available models from the API.
   *
   * Uses cached models if available and not expired (cached for 5 minutes).
   * If cache is expired or empty, fetches fresh data from `/v1/models`.
   *
   * @returns Promise resolving to an array of `InferenceApiModel` objects
   * @throws {Error} If the API returns a non-200 status or malformed response
   *
   * @example
   * ```ts
   * const models = await provider.getModels();
   * console.log(models.map(m => m.id)); // ["llama3", "mistral", ...]
   * ```
   *
   * @see {@link getBaseUrl}
   * @see {@link jsonToModels}
   */
  async getModels(): Promise<InferenceApiModel[]> {
    if (isDev) console.debug('v1Models', this.models);

    if (this.models.length > 0 && !this.isExpired(this.lastUpdatedModels)) {
      return this.models;
    }

    let fetchResponse = noResponse;
    try {
      fetchResponse = await fetch(
        normalizeUrl('/v1/models', this.getBaseUrl()),
        {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(1000),
        }
      );
    } catch {
      // Silently ignore network/timeout errors; will be caught in isErrorResponse
    }
    await this.isErrorResponse(fetchResponse);
    const json = await fetchResponse.json();
    this.models = this.jsonToModels(json.data);

    if (this.models.length > 0) this.lastUpdatedModels = Date.now();

    return this.models;
  }

  /**
   * Sends a chat completion request to the API with streaming support.
   *
   * Accepts a model name, message history, abort signal, and optional custom parameters.
   * Returns a streaming response via Server-Sent Events (SSE).
   *
   * @param model - The model identifier to use for completion (e.g., "llama3")
   * @param messages - Array of conversation messages following OpenAI format
   * @param abortSignal - AbortSignal to cancel the request if needed
   * @param customOptions - Optional override parameters for generation (e.g., temperature, max_tokens)
   * @returns Async generator yielding SSE events (chat completion tokens)
   * @throws {Error} If the API returns a non-200 status or malformed response
   *
   * @remarks
   * Default parameters include:
   * - `stream: true`
   *
   * Custom options are merged into the request body. Be cautious: invalid parameters
   * may cause API errors.
   *
   * @example
   * ```ts
   * const stream = await provider.postChatCompletions(
   *   'llama3',
   *   [{ role: 'user', content: 'Tell me a joke.' }],
   *   abortController.signal,
   *   { temperature: 0.7, max_tokens: 100 }
   * );
   * for await (const chunk of stream) {
   *   console.log(chunk.content);
   * }
   * ```
   *
   * @see {@link processSSEStream}
   * @see {@link getDefaultChatParams}
   * @see {@link isAllowCustomOptions}
   */
  async postChatCompletions(
    model: string,
    messages: readonly InferenceApiMessage[],
    abortSignal: AbortSignal,
    customOptions?: object
  ) {
    if (isDev) console.debug('v1ChatCompletions', { messages });

    // Prepare default parameters
    let params: Record<string, unknown> = {
      model,
      messages,
      ...this.getDefaultChatParams(),
    };

    // Merge custom options if provided
    if (
      this.isAllowCustomOptions() &&
      customOptions &&
      typeof customOptions === 'object'
    ) {
      params = { ...params, ...customOptions };
    }

    // Send request
    let fetchResponse = noResponse;
    try {
      fetchResponse = await fetch(
        normalizeUrl('/v1/chat/completions', this.getBaseUrl()),
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(params),
          signal: abortSignal,
        }
      );
    } catch {
      // Silently ignore network/timeout errors; will be caught in isErrorResponse
    }

    await this.isErrorResponse(fetchResponse);
    return processSSEStream<SSEChatCompletionMessage>(fetchResponse);
  }

  /**
   * Retrieves the list of available speech voices from the provider.
   * @returns {Promise<SpeechVoice[]>} A promise that resolves to an array of voice definitions.
   */
  async getVoices(): Promise<SpeechVoice[]> {
    if (isDev) console.debug('v1Voices', this.voices);

    if (this.voices.length > 0 && !this.isExpired(this.lastUpdatedVoices)) {
      return this.voices;
    }

    let fetchResponse = noResponse;
    try {
      fetchResponse = await fetch(
        normalizeUrl('v1/audio/voices', this.getBaseUrl()),
        {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(1000),
        }
      );
    } catch {
      // Silently ignore network/timeout errors; will be caught in isErrorResponse
    }
    await this.isErrorResponse(fetchResponse);
    const json = await fetchResponse.json();
    this.voices = json.data && Array.isArray(json.data) ? [...json.data] : [];

    if (this.voices.length > 0) this.lastUpdatedVoices = Date.now();

    return this.voices;
  }

  /**
   * Generates audio from text using the specified parameters.
   * @param {SpeechCreateParams} params - Configuration for speech synthesis (text, voice, speed, etc.).
   * @param {AbortSignal} abortSignal - Signal to cancel the request if needed.
   * @returns {Promise<Blob>} The generated audio data as a Blob (e.g., MP3 or WAV).
   */
  async postSpeech(
    params: SpeechCreateParams,
    abortSignal: AbortSignal
  ): Promise<Blob> {
    if (isDev) console.debug('v1Speech', params);

    let fetchResponse = noResponse;
    try {
      fetchResponse = await fetch(
        normalizeUrl('v1/audio/speech', this.getBaseUrl()),
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(params),
          signal: abortSignal,
        }
      );
    } catch {
      // Silently ignore network/timeout errors; will be caught in isErrorResponse
    }

    await this.isErrorResponse(fetchResponse);
    return fetchResponse.blob();
  }

  /**
   * Generates HTTP headers for API requests, including authentication.
   *
   * Includes:
   * - `Content-Type: application/json`
   * - `Authorization: Bearer <apiKey>` if API key is provided
   *
   * @returns Headers configuration suitable for `fetch` requests
   *
   * @protected
   */
  protected getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = this.getApiKey();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * Validates the HTTP response and throws an appropriate error if status is not 200.
   *
   * Attempts to parse response body as JSON for detailed error messages.
   * Logs errors to console in development mode.
   *
   * @param response - The HTTP response object from fetch
   * @throws {Error} With specific message based on HTTP status code or API error body
   *
   * @protected
   */
  protected async isErrorResponse(response: Response): Promise<void> {
    if (response.status === 200) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try {
      body = await response.json();
    } catch (e) {
      // Fallback if response is not JSON (e.g., plain text or empty)
      console.warn('Non-JSON response received:', e);
    }

    if (Object.keys(body).length > 0) {
      console.error('API error response:', body);
    }

    // Map HTTP status codes to human-readable errors
    switch (response.status) {
      case 400:
        throw new Error('Bad request: Invalid parameters or malformed input');
      case 401:
        throw new Error('Unauthorized: Invalid or missing API key');
      case 402:
        throw new Error(
          'Payment required: Quota exceeded or subscription needed'
        );
      case 403:
        throw new Error('Forbidden: Access denied');
      case 404:
        throw new Error(
          'Not found: The requested endpoint or model does not exist'
        );
      case 429:
        throw new Error('Too many requests: Rate limit exceeded');
      case 444:
        throw new Error(
          'No response: Server closed connection without response'
        );
      case 500:
        throw new Error('Internal server error: Please try again later');
      case 502:
        throw new Error('Bad gateway: Backend service is unavailable');
      case 503:
        throw new Error('Service unavailable: Server is temporarily down');
      case 504:
        throw new Error('Gateway timeout: Backend took too long to respond');
      default:
        throw new Error(
          body?.error?.message || `Unknown error: HTTP ${response.status}`
        );
    }
  }

  /**
   * Determines whether the cached model list has expired.
   *
   * Cache expires after 5 minutes to ensure freshness.
   *
   * @returns `true` if the cache is expired, `false` otherwise
   *
   * @protected
   */
  protected isExpired(lastUpdated: number): boolean {
    return Date.now() - lastUpdated > 5 * 60 * 1000;
  }

  /**
   * Indicates whether custom generation options (e.g., temperature, max_tokens) are allowed.
   *
   * Override in subclasses to enable support.
   *
   * @returns `false` by default
   *
   * @protected
   */
  protected isAllowCustomOptions(): boolean {
    return false;
  }

  protected getDefaultChatParams(): Record<string, unknown> {
    return { stream: true };
  }

  /**
   * Converts raw JSON data from `/v1/models` into an array of `InferenceApiModel` objects.
   *
   * Filters invalid entries and sorts models by creation time (descending) or name.
   *
   * @param data - Raw JSON array from API response (`data` field of `/v1/models`)
   * @returns Sorted array of `InferenceApiModel` objects
   *
   * @protected
   */
  protected jsonToModels(data: unknown[]): InferenceApiModel[] {
    const res: InferenceApiModel[] = [];
    if (data && Array.isArray(data)) {
      data.forEach((m) => {
        res.push(this.jsonToModel(m));
      });
      res.sort(this.compareModels);
    }
    return res;
  }

  /**
   * Converts a single JSON model object into an `InferenceApiModel`.
   *
   * This is a passthrough by default. Override in subclasses for provider-specific parsing.
   *
   * @param m - Raw model data from API response
   * @returns A validated `InferenceApiModel` object
   *
   * @protected
   */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as InferenceApiModel;
    return {
      ...model,
      name: model.name || model.id,
    };
  }

  /**
   * Compares two models for sorting.
   *
   * Sorts by `created` timestamp (descending) if available; otherwise by `name` (ascending).
   *
   * @param a - First model to compare
   * @param b - Second model to compare
   * @returns Negative, zero, or positive value for sorting order
   *
   * @protected
   */
  protected compareModels(a: InferenceApiModel, b: InferenceApiModel): number {
    const aCreated = a.created ?? 0;
    const bCreated = b.created ?? 0;

    if (aCreated !== bCreated) {
      return bCreated - aCreated; // Newest first
    }

    return a.name.localeCompare(b.name); // Alphabetical fallback
  }

  /**
   * Returns the base URL configured for this provider.
   *
   * @returns The base URL of the API endpoint
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Returns the API key configured for authentication.
   *
   * @returns The Bearer token used for API requests
   */
  getApiKey(): string {
    return this.apiKey;
  }
}

/**
 * A provider implementation for Self-Hosted OpenAI instances.
 *
 * This class extends {@link BaseOpenAIProvider} and defines a shorter
 * token expiration threshold suitable for self-hosted environments,
 * where tokens may be refreshed more frequently due to local infrastructure
 * or security policies.
 *
 * @remarks
 * The expiration threshold is set to **60 seconds** (60,000 milliseconds),
 * reflecting the typical short-lived token validity in self-hosted deployments.
 */
export class SelfHostedOpenAIProvider extends BaseOpenAIProvider {
  /**
   * Determines whether the current API token has expired based on the last update time.
   *
   * For self-hosted providers, the token is considered expired if more than
   * 60 seconds have passed since the last update.
   *
   * @returns `true` if the token has expired; otherwise, `false`.
   * @inheritdoc
   */
  protected isExpired(): boolean {
    return Date.now() - this.lastUpdatedModels > 60 * 1000;
  }
}

/**
 * A provider implementation for Cloud-based OpenAI services (e.g., OpenAI API).
 *
 * This class extends {@link BaseOpenAIProvider} and defines a longer
 * token expiration threshold appropriate for cloud-based APIs,
 * where token refresh cycles are typically longer and less frequent.
 *
 * @remarks
 * The expiration threshold is set to **15 minutes** (900,000 milliseconds),
 * aligning with standard token lifetimes in OpenAI's cloud API offerings.
 */
export class CloudOpenAIProvider extends BaseOpenAIProvider {
  /**
   * Determines whether the current API token has expired based on the last update time.
   *
   * For cloud providers, the token is considered expired if more than
   * 15 minutes have passed since the last update.
   *
   * @returns `true` if the token has expired; otherwise, `false`.
   * @inheritdoc
   */
  protected isExpired(): boolean {
    return Date.now() - this.lastUpdatedModels > 15 * 60 * 1000;
  }

  /** @inheritdoc */
  protected isAllowCustomOptions(): boolean {
    return false;
  }
}
