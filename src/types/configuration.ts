export type ProviderOption = {
  name: string;
  baseUrl: string;
  icon?: string;
  allowCustomBaseUrl: boolean;
};

export interface Configuration {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemMessage: string;

  /* ui */
  initials: string;

  /* conversations */
  pasteLongTextToFileLen: number;
  pdfAsImage: boolean;
  showTokensPerSecond: boolean;
  showThoughtInProgress: boolean;
  excludeThoughtOnReq: boolean;

  /* advanced */
  /* generation */
  overrideGenerationOptions: boolean;
  temperature: number;
  top_k: number;
  top_p: number;
  min_p: number;
  max_tokens: number;

  /* samplers */
  overrideSamplersOptions: boolean;
  samplers: string;
  dynatemp_range: number;
  dynatemp_exponent: number;
  typical_p: number;
  xtc_probability: number;
  xtc_threshold: number;

  /* penalty */
  overridePenaltyOptions: boolean;
  repeat_last_n: number;
  repeat_penalty: number;
  presence_penalty: number;
  frequency_penalty: number;
  dry_multiplier: number;
  dry_base: number;
  dry_allowed_length: number;
  dry_penalty_last_n: number;

  custom: string;

  /* experimental */
  pyIntepreterEnabled: boolean;

  /* text to speech */
  ttsVoice: string;
  ttsPitch: number;
  ttsRate: number;
  ttsVolume: number;
}
export type ConfigurationKey = keyof Configuration;

export interface ConfigurationPreset {
  id: string;
  name: string;
  createdAt: number;
  config: Partial<Configuration>;
}

export interface InferenceProviders {
  [key: string]: {
    baseUrl: string;
    name: string;
    icon: string;
    allowCustomBaseUrl: boolean;
    isKeyRequired: boolean;
  };
}
export type InferenceProvidersKey = keyof InferenceProviders;

/**
 * Data format on export messages
 */
export type ExportJsonStructure = Array<{
  table: string;
  rows: unknown[];
}>;

export enum CanvasType {
  PY_INTERPRETER,
}

export interface CanvasPyInterpreter {
  type: CanvasType.PY_INTERPRETER;
  content: string;
}

export type CanvasData = CanvasPyInterpreter;
