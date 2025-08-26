export interface TimingReport {
  prompt_n: number;
  prompt_ms: number;
  predicted_n: number;
  predicted_ms: number;
}

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
}
export type ConfigurationKey = keyof Configuration;

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
 * What is conversation "branching"? It is a feature that allows the user to edit an old message in the history, while still keeping the conversation flow.
 * Inspired by ChatGPT / Claude / Hugging Chat where you edit a message, a new branch of the conversation is created, and the old message is still visible.
 *
 * We use the same node-based structure like other chat UIs, where each message has a parent and children. A "root" message is the first message in a conversation, which will not be displayed in the UI.
 *
 * root
 *  ├── message 1
 *  │      └── message 2
 *  │             └── message 3
 *  └── message 4
 *        └── message 5
 *
 * In the above example, assuming that user wants to edit message 2, a new branch will be created:
 *
 *          ├── message 2
 *          │   └── message 3
 *          └── message 6
 *
 * Message 2 and 6 are siblings, and message 6 is the new branch.
 *
 * We only need to know the last node (aka leaf) to get the current branch. In the above example, message 5 is the leaf of branch containing message 4 and 5.
 *
 * For the implementation:
 * - StorageUtils.getMessages() returns list of all nodes
 * - StorageUtils.filterByLeafNodeId() filters the list of nodes from a given leaf node
 */

// Note: the term "message" and "node" are used interchangeably in this context
export interface Message {
  id: number;
  convId: string;
  type: 'text' | 'root';
  timestamp: number; // timestamp from Date.now()
  model?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
  timings?: TimingReport;
  extra?: MessageExtra[];
  // node based system for branching
  parent: Message['id'];
  children: Message['id'][];
}

export type MessageExtra =
  | MessageExtraTextFile
  | MessageExtraImageFile
  | MessageExtraAudioFile
  | MessageExtraContext;

export interface MessageExtraTextFile {
  type: 'textFile';
  name: string;
  content: string;
}

export interface MessageExtraImageFile {
  type: 'imageFile';
  name: string;
  base64Url: string;
}

export interface MessageExtraAudioFile {
  type: 'audioFile';
  name: string;
  base64Data: string;
  mimeType: string;
}

export interface MessageExtraContext {
  type: 'context';
  name: string;
  content: string;
}

export interface Conversation {
  id: string; // format: `conv-{timestamp}`
  lastModified: number; // timestamp from Date.now()
  currNode: Message['id']; // the current message node being viewed
  name: string;
  forkSource?: {
    convId: string;
    messageId: Message['id'];
  };
}

export interface ViewingChat {
  conv: Readonly<Conversation>;
  messages: Readonly<Message[]>;
}

export type PendingMessage = Omit<Message, 'content' | 'reasoning_content'> & {
  content: string | null;
  reasoning_content: string | null;
};

/**
 * A message display is a message node with additional information for rendering.
 * For example, siblings of the message node are stored as their last node (aka leaf node).
 */
export interface MessageDisplay {
  msg: Message | PendingMessage;
  siblingLeafNodeIds: Message['id'][];
  siblingCurrIdx: number;
  isPending?: boolean;
}

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
