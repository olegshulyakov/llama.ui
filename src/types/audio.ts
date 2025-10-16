export type SpeechModel = string;
export type SpeechVoice = string;

export interface SpeechCreateParams {
  /**
   * The text to generate audio for. The maximum length is 4096 characters.
   */
  input: string;

  /**
   * One of the available [TTS models](https://platform.openai.com/docs/models#tts).
   */
  model: SpeechModel;

  /**
   * The voice to use when generating the audio. Previews of the voices are available in the
   * [Text to speech guide](https://platform.openai.com/docs/guides/text-to-speech#voice-options).
   */
  voice: SpeechVoice;

  /**
   * Control the voice of your generated audio with additional instructions.
   */
  instructions?: string;

  /**
   * The format to audio in. Supported formats are `mp3`, `opus`, `aac`, `flac`, `wav`, and `pcm`.
   */
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

  /**
   * The speed of the generated audio. Select a value from `0.25` to `4.0`. `1.0` is the default.
   */
  speed?: number;

  /**
   * The format to stream the audio in. Supported formats are `sse` and `audio`.
   */
  stream_format?: 'sse' | 'audio';
}
