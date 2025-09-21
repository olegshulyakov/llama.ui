import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  BookmarkIcon,
  ChatBubbleLeftEllipsisIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  CogIcon,
  CpuChipIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FunnelIcon,
  HandRaisedIcon,
  PencilIcon,
  PlayCircleIcon,
  RocketLaunchIcon,
  SignalIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  SquaresPlusIcon,
  TrashIcon,
  TvIcon,
} from '@heroicons/react/24/outline';
import React, {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { Dropdown } from '../components/common';
import { useModals } from '../components/ModalProvider';
import TextToSpeech, {
  getSpeechSynthesisVoiceByName,
  getSpeechSynthesisVoices,
  IS_SPEECH_SYNTHESIS_SUPPORTED,
} from '../components/TextToSpeech';
import {
  CONFIG_DEFAULT,
  INFERENCE_PROVIDERS,
  SYNTAX_THEMES,
  THEMES,
} from '../config';
import { useAppContext } from '../context/app';
import { useChatContext } from '../context/chat';
import { useInferenceContext } from '../context/inference';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useLang, type LanguageResource } from '../lang';
import {
  Configuration,
  ConfigurationKey,
  ConfigurationPreset,
  InferenceApiModel,
  InferenceProvidersKey,
  ProviderOption,
} from '../types';
import {
  classNames,
  dateFormatter,
  isBoolean,
  isNumeric,
  isString,
  normalizeUrl,
} from '../utils';

// --- Type Definitions ---
enum SettingInputType {
  SHORT_INPUT,
  LONG_INPUT,
  RANGE_INPUT,
  CHECKBOX,
  DROPDOWN,
  CUSTOM,
  SECTION,
}

type SettingFieldInputType = Exclude<
  SettingInputType,
  SettingInputType.CUSTOM | SettingInputType.SECTION
>;

interface SettingFieldInput {
  type: SettingFieldInputType;
  label: string | React.ReactElement;
  note?: string | TrustedHTML;
  key: ConfigurationKey;
  disabled?: boolean;
  [key: string]: unknown; // Allow additional properties
}

interface SettingFieldCustom {
  type: SettingInputType.CUSTOM;
  key:
    | ConfigurationKey
    | 'custom'
    | 'import-export'
    | 'preset-manager'
    | 'fetch-models'
    | 'theme-manager';
  component:
    | string
    | React.FC<{
        value: string | boolean | number;
        onChange: (value: string | boolean) => void;
      }>
    | 'delimeter';
}

interface DropdownOption {
  value: string | number;
  label: string;
  icon?: string;
}
interface SettingFieldDropdown extends SettingFieldInput {
  type: SettingInputType.DROPDOWN;
  options: DropdownOption[];
  filterable: boolean;
}

interface SettingSection {
  type: SettingInputType.SECTION;
  label: string | React.ReactElement;
}

type SettingField =
  | SettingFieldInput
  | SettingFieldCustom
  | SettingSection
  | SettingFieldDropdown;

interface SettingTab {
  title: React.ReactElement;
  fields: SettingField[];
}

// --- Helper Functions ---

const ICON_CLASSNAME = 'w-4 h-4 mr-1 inline';

const toSection = (
  label: string | ReactElement,
  icon?: string | ReactElement
): SettingSection => {
  return {
    type: SettingInputType.SECTION,
    label: (
      <>
        {icon}
        {label}
      </>
    ),
  };
};

const toInput = (
  lang: LanguageResource,
  type: SettingFieldInputType,
  key: ConfigurationKey,
  disabled: boolean = false,
  additional?: Record<string, unknown>
): SettingFieldInput => {
  return {
    type,
    label: lang.settings.parameters[key].label,
    note: lang.settings.parameters[key].note,
    disabled,
    key,
    ...additional,
  };
};
const toDropdown = (
  lang: LanguageResource,
  key: ConfigurationKey,
  options: DropdownOption[],
  filterable: boolean = false,
  disabled: boolean = false
): SettingFieldDropdown => {
  return {
    type: SettingInputType.DROPDOWN,
    key,
    disabled,
    label: lang.settings.parameters[key].label,
    note: lang.settings.parameters[key].note,
    options,
    filterable,
  };
};

const DELIMETER: SettingFieldCustom = {
  type: SettingInputType.CUSTOM,
  key: 'custom',
  component: 'delimeter',
};

// --- Setting Tabs Configuration ---
const UnusedCustomField: React.FC = () => null;

const getSettingTabsConfiguration = (
  lang: LanguageResource,
  config: Configuration,
  models: InferenceApiModel[]
): SettingTab[] => [
  /* General */
  {
    title: (
      <>
        <Cog6ToothIcon className={ICON_CLASSNAME} />
        General
      </>
    ),
    fields: [
      toSection('Inference Provider'),
      toDropdown(
        lang,
        'provider',
        Object.entries(INFERENCE_PROVIDERS).map(
          ([key, val]: [string, ProviderOption]) => ({
            value: key,
            label: val.name,
            icon: val.icon,
          })
        )
      ),
      toInput(
        lang,
        SettingInputType.SHORT_INPUT,
        'baseUrl',
        !INFERENCE_PROVIDERS[config.provider]?.allowCustomBaseUrl
      ),
      toInput(lang, SettingInputType.SHORT_INPUT, 'apiKey'),
      toDropdown(
        lang,
        'model',
        models.map((m) => ({
          value: m.id,
          label: m.name,
        })),
        true
      ),
      {
        type: SettingInputType.CUSTOM,
        key: 'fetch-models',
        component: UnusedCustomField,
      },

      DELIMETER,
      DELIMETER,
      toInput(lang, SettingInputType.LONG_INPUT, 'systemMessage'),
    ],
  },

  /* UI */
  {
    title: (
      <>
        <TvIcon className={ICON_CLASSNAME} />
        UI
      </>
    ),
    fields: [
      toInput(lang, SettingInputType.SHORT_INPUT, 'initials'),
      {
        type: SettingInputType.CUSTOM,
        key: 'theme-manager',
        component: UnusedCustomField,
      },
    ],
  },

  /* Voice */
  {
    title: (
      <>
        <SignalIcon className={ICON_CLASSNAME} />
        Voice
      </>
    ),
    fields: [
      /* Text to Speech */
      toSection(
        'Text to Speech',
        <SpeakerWaveIcon className={ICON_CLASSNAME} />
      ),
      toDropdown(
        lang,
        'ttsVoice',
        !IS_SPEECH_SYNTHESIS_SUPPORTED
          ? []
          : getSpeechSynthesisVoices().map((voice) => ({
              value: `${voice.name} (${voice.lang})`,
              label: `${voice.name} (${voice.lang})`,
            })),
        true
      ),
      toInput(
        lang,
        SettingInputType.RANGE_INPUT,
        'ttsPitch',
        !IS_SPEECH_SYNTHESIS_SUPPORTED,
        {
          min: 0,
          max: 2,
          step: 0.5,
        }
      ),
      toInput(
        lang,
        SettingInputType.RANGE_INPUT,
        'ttsRate',
        !IS_SPEECH_SYNTHESIS_SUPPORTED,
        {
          min: 0.5,
          max: 2,
          step: 0.5,
        }
      ),
      toInput(
        lang,
        SettingInputType.RANGE_INPUT,
        'ttsVolume',
        !IS_SPEECH_SYNTHESIS_SUPPORTED,
        {
          min: 0,
          max: 1,
          step: 0.25,
        }
      ),
      {
        type: SettingInputType.CUSTOM,
        key: 'custom', // dummy key, won't be used
        component: () => (
          <TextToSpeech
            text={lang.settings.textToSpeech.check.text}
            voice={getSpeechSynthesisVoiceByName(config.ttsVoice)}
            pitch={config.ttsPitch}
            rate={config.ttsRate}
            volume={config.ttsVolume}
          >
            {({ isPlaying, play }) => (
              <button
                className="btn"
                onClick={() => (!isPlaying ? play() : stop())}
                disabled={!IS_SPEECH_SYNTHESIS_SUPPORTED}
                title="Play test message"
                aria-label="Play test message"
              >
                {!isPlaying && <SpeakerWaveIcon className={ICON_CLASSNAME} />}
                {isPlaying && <SpeakerXMarkIcon className={ICON_CLASSNAME} />}
                {lang.settings.textToSpeech.check.label}
              </button>
            )}
          </TextToSpeech>
        ),
      },
    ],
  },

  /* Conversations */
  {
    title: (
      <>
        <ChatBubbleLeftRightIcon className={ICON_CLASSNAME} />
        Conversations
      </>
    ),
    fields: [
      toSection(
        'Chat',
        <ChatBubbleLeftEllipsisIcon className={ICON_CLASSNAME} />
      ),
      toInput(lang, SettingInputType.SHORT_INPUT, 'pasteLongTextToFileLen'),
      toInput(lang, SettingInputType.CHECKBOX, 'pdfAsImage'),

      /* Performance */
      DELIMETER,
      toSection('Performance', <RocketLaunchIcon className={ICON_CLASSNAME} />),
      toInput(lang, SettingInputType.CHECKBOX, 'showTokensPerSecond'),

      /* Reasoning */
      DELIMETER,
      toSection(
        'Reasoning',
        <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
      ),
      toInput(lang, SettingInputType.CHECKBOX, 'showThoughtInProgress'),
      toInput(lang, SettingInputType.CHECKBOX, 'excludeThoughtOnReq'),
    ],
  },

  /* Presets */
  {
    title: (
      <>
        <BookmarkIcon className={ICON_CLASSNAME} />
        Presets
      </>
    ),
    fields: [
      {
        type: SettingInputType.CUSTOM,
        key: 'preset-manager',
        component: UnusedCustomField,
      },
    ],
  },

  /* Import/Export */
  {
    title: (
      <>
        <CircleStackIcon className={ICON_CLASSNAME} />
        Import/Export
      </>
    ),
    fields: [
      {
        type: SettingInputType.CUSTOM,
        key: 'import-export',
        component: UnusedCustomField,
      },
    ],
  },

  /* Advanced */
  {
    title: (
      <>
        <SquaresPlusIcon className={ICON_CLASSNAME} />
        Advanced
      </>
    ),
    fields: [
      /* Generation */
      toSection('Generation', <CogIcon className={ICON_CLASSNAME} />),
      toInput(lang, SettingInputType.CHECKBOX, 'overrideGenerationOptions'),
      ...['temperature', 'top_k', 'top_p', 'min_p', 'max_tokens'].map((key) =>
        toInput(
          lang,
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overrideGenerationOptions']
        )
      ),

      /* Samplers */
      DELIMETER,
      toSection('Samplers', <FunnelIcon className={ICON_CLASSNAME} />),
      toInput(lang, SettingInputType.CHECKBOX, 'overrideSamplersOptions'),
      ...[
        'samplers',
        'dynatemp_range',
        'dynatemp_exponent',
        'typical_p',
        'xtc_probability',
        'xtc_threshold',
      ].map((key) =>
        toInput(
          lang,
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overrideSamplersOptions']
        )
      ),

      /* Penalties */
      DELIMETER,
      toSection('Penalties', <HandRaisedIcon className={ICON_CLASSNAME} />),
      toInput(lang, SettingInputType.CHECKBOX, 'overridePenaltyOptions'),
      ...[
        'repeat_last_n',
        'repeat_penalty',
        'presence_penalty',
        'frequency_penalty',
        'dry_multiplier',
        'dry_base',
        'dry_allowed_length',
        'dry_penalty_last_n',
      ].map((key) =>
        toInput(
          lang,
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overridePenaltyOptions']
        )
      ),

      /* Custom */
      DELIMETER,
      toSection('Custom', <CpuChipIcon className={ICON_CLASSNAME} />),
      toInput(lang, SettingInputType.LONG_INPUT, 'custom'),
    ],
  },

  /* Experimental */
  {
    title: (
      <>
        <BeakerIcon className={ICON_CLASSNAME} />
        Experimental
      </>
    ),
    fields: [
      {
        type: SettingInputType.CUSTOM,
        key: 'custom', // dummy key, won't be used
        component: () => (
          <div className="flex flex-col gap-2 mb-8">
            <p>Experimental features are not guaranteed to work correctly.</p>
            <p>
              If you encounter any problems, create a{' '}
              <a
                className="underline"
                href="https://github.com/ggerganov/llama.cpp/issues/new?template=019-bug-misc.yml"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bug (misc.)
              </a>{' '}
              report on Github. Please also specify <b>webui/experimental</b> on
              the report title and include screenshots.
            </p>
            <p>
              Some features may require packages downloaded from CDN, so they
              need internet connection.
            </p>
          </div>
        ),
      },
      toInput(lang, SettingInputType.CHECKBOX, 'pyIntepreterEnabled'),
    ],
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const {
    config,
    saveConfig,
    presets,
    savePreset,
    removePreset,
    setShowSettings,
  } = useAppContext();
  const { models, fetchModels } = useInferenceContext();
  const { viewingChat } = useChatContext();
  const [tabIdx, setTabIdx] = useState(0);

  // clone the config object to prevent direct mutation
  const [localConfig, setLocalConfig] = useState<Configuration>(
    Object.assign({}, config)
  );
  const [localModels, setLocalModels] = useState<InferenceApiModel[]>(
    Object.assign([], models)
  );
  const settingTabs = useMemo<SettingTab[]>(
    () => getSettingTabsConfiguration(lang, localConfig, localModels),
    [lang, localConfig, localModels]
  );
  const currConv = useMemo(() => viewingChat?.conv ?? null, [viewingChat]);

  useEffect(() => {
    setShowSettings(true);

    return () => {
      setShowSettings(false);
    };
  }, [setShowSettings]);

  const { showConfirm, showAlert } = useModals();

  const onClose = useCallback(() => {
    if (currConv) navigate(`/chat/${currConv.id}`);
    else navigate('/');
  }, [currConv, navigate]);

  const resetConfig = async () => {
    if (await showConfirm('Are you sure you want to reset all settings?')) {
      setLocalConfig({ ...CONFIG_DEFAULT } as Configuration);
    }
  };

  const handleSave = async (config: Configuration) => {
    // copy the local config to prevent direct mutation
    const newConfig: Configuration = JSON.parse(JSON.stringify(config));
    // validate the config
    for (const key in newConfig) {
      if (!(key in CONFIG_DEFAULT)) continue;

      const typedKey = key as ConfigurationKey;
      const value = newConfig[typedKey];
      const defaultValue = CONFIG_DEFAULT[typedKey];
      if (isString(defaultValue)) {
        if (!isString(value)) {
          await showAlert(`Value for ${key} must be a string`);
          return;
        }
      } else if (isNumeric(defaultValue)) {
        const trimmedValue = String(value).trim();
        const numVal = Number(trimmedValue);
        if (isNaN(numVal) || !isNumeric(numVal) || trimmedValue === '') {
          await showAlert(`Value for ${key} must be numeric`);
          return;
        }
        // force conversion to number
        // @ts-expect-error this is safe
        newConfig[typedKey] = numVal as Configuration[ConfigurationKey];
      } else if (isBoolean(defaultValue)) {
        if (!isBoolean(value)) {
          await showAlert(`Value for ${key} must be boolean`);
          return;
        }
      } else {
        console.error(`Unknown default type for key ${key}`);
      }
    }
    saveConfig(newConfig);
    onClose();
  };

  const debouncedFetchModels = useDebouncedCallback(
    (newConfig: Configuration) =>
      fetchModels(newConfig, { silent: true }).then((models) =>
        setLocalModels(models)
      ),
    1000
  );

  const onChange =
    (key: ConfigurationKey) => (value: string | number | boolean) => {
      // note: we do not perform validation here, because we may get incomplete value as user is still typing it
      setLocalConfig((prevConfig) => {
        let newConfig = {
          ...prevConfig,
          [key]: value,
        };

        if (key === 'provider') {
          const typedKey = value as InferenceProvidersKey;
          const providerInfo = INFERENCE_PROVIDERS[typedKey];
          if (providerInfo?.baseUrl) {
            newConfig = {
              ...newConfig,
              baseUrl: providerInfo.baseUrl,
            };
          }
        }

        if (['provider', 'baseUrl', 'apiKey'].includes(key)) {
          debouncedFetchModels(newConfig);
        }

        return newConfig;
      });
    };

  const mapFieldToElement = (field: SettingField, idx: number) => {
    const key = `${tabIdx}-${idx}`;

    switch (field.type) {
      case SettingInputType.SHORT_INPUT:
        return (
          <SettingsModalShortInput
            key={key}
            configKey={field.key}
            field={field}
            value={localConfig[field.key] as string | number}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.RANGE_INPUT:
        return (
          <SettingsModalRangeInput
            key={key}
            configKey={field.key}
            field={field}
            min={field.min as number}
            max={field.max as number}
            step={field.step as number}
            value={localConfig[field.key] as number}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.LONG_INPUT:
        return (
          <SettingsModalLongInput
            key={key}
            configKey={field.key}
            field={field}
            value={String(localConfig[field.key])}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.CHECKBOX:
        return (
          <SettingsModalCheckbox
            key={key}
            configKey={field.key}
            field={field}
            value={!!localConfig[field.key]}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.DROPDOWN:
        return (
          <SettingsModalDropdown
            key={key}
            configKey={field.key}
            field={field as SettingFieldInput}
            options={(field as SettingFieldDropdown).options}
            filterable={(field as SettingFieldDropdown).filterable}
            value={String(localConfig[field.key])}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.CUSTOM:
        switch (field.key) {
          case 'import-export':
            return <ImportExportComponent key={key} onClose={onClose} />;
          case 'preset-manager':
            return (
              <PresetManager
                key={key}
                config={localConfig}
                onLoadConfig={handleSave}
                presets={presets}
                onSavePreset={savePreset}
                onRemovePreset={removePreset}
              />
            );
          case 'theme-manager':
            return <ThemeController key={key} />;
          case 'fetch-models':
            return (
              <button
                key={key}
                className="btn"
                onClick={() =>
                  fetchModels(localConfig).then((models) =>
                    setLocalModels(models)
                  )
                }
              >
                <ArrowPathIcon className={ICON_CLASSNAME} />
                Fetch Models
              </button>
            );
          default:
            if (field.component === 'delimeter') {
              return <DelimeterComponent key={key} />;
            }

            switch (typeof field.component) {
              case 'string':
              case 'number':
              case 'bigint':
              case 'boolean':
              case 'symbol':
                return (
                  <div key={key} className="mb-2">
                    {field.component}
                  </div>
                );
              default:
                return (
                  <div key={key} className="mb-2">
                    {React.createElement(field.component, {
                      value: localConfig[field.key],
                      onChange: (value: string | boolean) =>
                        onChange(field.key as ConfigurationKey)(value),
                    })}
                  </div>
                );
            }
        }
      case SettingInputType.SECTION:
        return (
          <SettingsSectionLabel key={key}>{field.label}</SettingsSectionLabel>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full py-4">
      <div className="grow flex flex-col md:flex-row">
        {/* Left panel, showing sections - Desktop version */}
        <div
          className="hidden md:flex flex-col items-stretch px-4 border-r-2 border-base-200"
          role="complementary"
          aria-description="Settings sections"
          tabIndex={0}
        >
          {settingTabs.map((tab, idx) => (
            <button
              key={idx}
              className={classNames({
                'btn btn-ghost justify-start font-normal w-44 mb-1': true,
                'btn-active': tabIdx === idx,
              })}
              onClick={() => setTabIdx(idx)}
              dir="auto"
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Left panel, showing sections - Mobile version */}
        {/* This menu is skipped on a11y, otherwise it's repeated the desktop version */}
        <div
          className="md:hidden flex flex-row gap-2 mb-4 px-4"
          aria-disabled={true}
        >
          <Dropdown
            className="bg-base-200 w-full border-1 border-base-content/10 rounded-lg shadow-xs cursor-pointer p-2"
            entity="tab"
            options={settingTabs.map((tab, idx) => ({
              label: tab.title,
              value: idx,
            }))}
            currentValue={settingTabs[tabIdx].title}
            renderOption={(option) => <span>{option.label}</span>}
            isSelected={(option) => tabIdx === option.value}
            onSelect={(option) => setTabIdx(option.value as number)}
          />
        </div>

        {/* Right panel, showing setting fields */}
        <div className="grow max-h-[calc(100vh-13rem)] md:max-h-[calc(100vh-10rem)] overflow-y-auto px-6 sm:px-4">
          {settingTabs[tabIdx].fields.map(mapFieldToElement)}

          <p className="opacity-40 text-sm mt-8">
            App Version: {import.meta.env.PACKAGE_VERSION}
            <br />
            Settings are saved in browser's localStorage
          </p>
        </div>
      </div>

      <div className="sticky bottom-4 flex gap-2 max-md:justify-center mt-4">
        <div className="hidden md:block w-54 h-10" />
        <button
          className="btn btn-neutral"
          onClick={() => handleSave(localConfig)}
        >
          {lang.settings.actionButtons.saveBtnLabel}
        </button>
        <button className="btn" onClick={onClose}>
          {lang.settings.actionButtons.cancelBtnLabel}
        </button>
        <button className="btn" onClick={resetConfig}>
          {lang.settings.actionButtons.resetBtnLabel}
        </button>
      </div>
    </div>
  );
}

// --- Helper Input Components ---

interface BaseInputProps {
  configKey: ConfigurationKey | 'custom';
  field: SettingFieldInput;
  onChange: (value: string | number | boolean) => void;
}

const SettingsModalLongInput: React.FC<BaseInputProps & { value: string }> = ({
  configKey,
  field,
  value,
  onChange,
}) => {
  return (
    <label className="form-control flex flex-col justify-center max-w-80 mb-3">
      <div className="text-sm opacity-60 mb-1">{field.label || configKey}</div>
      <textarea
        className="textarea textarea-bordered h-24"
        placeholder={`Default: ${CONFIG_DEFAULT[configKey] || 'none'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={field.disabled}
      />
      {field.note && (
        <div
          className="text-xs opacity-75 mt-1"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </label>
  );
};

const SettingsModalShortInput: React.FC<
  BaseInputProps & { value: string | number }
> = ({ configKey, field, value, onChange }) => {
  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
        {field.label || configKey}
      </div>
      <label className="input input-bordered join-item grow flex items-center gap-2 mb-1">
        <div tabIndex={0} role="button" className="font-bold hidden md:block">
          {field.label || configKey}
        </div>
        <input
          type="text"
          className="grow"
          placeholder={`Default: ${CONFIG_DEFAULT[configKey] || 'none'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={field.disabled}
        />
      </label>
      {field.note && (
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </label>
  );
};

const SettingsModalRangeInput: React.FC<
  BaseInputProps & {
    value: number;
    min: number;
    max: number;
    step: number;
  }
> = ({ configKey, field, value, min, max, step, onChange }) => {
  const values = useMemo(() => {
    const fractionDigits =
      Math.floor(step) === step ? 0 : step.toString().split('.')[1].length || 0;

    const length = Math.floor((max - min) / step) + 1;
    return Array.from({ length }, (_, i) =>
      Number(min + i * step).toFixed(fractionDigits)
    );
  }, [max, min, step]);
  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
        {field.label || configKey}
      </div>
      <label className="input input-bordered join-item grow flex items-center gap-2 mb-1">
        <div tabIndex={0} role="button" className="font-bold hidden md:block">
          {field.label || configKey}
        </div>
        <div className="grow px-2">
          <input
            type="range"
            className="range range-xs [--range-fill:0]"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.disabled}
          />
          <div className="flex justify-between text-xs">
            {values.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
        </div>
      </label>
      {field.note && (
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </label>
  );
};

const SettingsModalCheckbox: React.FC<BaseInputProps & { value: boolean }> = ({
  configKey,
  field,
  value,
  onChange,
}) => {
  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div className="flex flex-row items-center mb-1">
        <input
          type="checkbox"
          className="toggle"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={field.disabled}
        />
        <span className="ml-2">{field.label || configKey}</span>
      </div>
      {field.note && (
        <div
          className="text-xs opacity-75 max-w-80 mt-1"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </label>
  );
};

const SettingsModalDropdown: React.FC<
  BaseInputProps & {
    options: DropdownOption[];
    filterable?: boolean;
    value: string;
  }
> = ({ configKey, field, options, filterable = false, value, onChange }) => {
  const renderOption = (option: DropdownOption) => (
    <span className="truncate">
      {option.icon && (
        <img
          src={normalizeUrl(option.icon, import.meta.env.BASE_URL)}
          className="inline h-5 w-5 mr-2"
        />
      )}
      {option.label}
    </span>
  );

  const disabled = useMemo(() => options.length < 2, [options]);
  const selectedValue = useMemo(() => {
    const selectedOption = options.find((option) => option.value === value);
    return selectedOption ? (
      <span className="max-w-48 truncate text-nowrap">
        {selectedOption.label}
      </span>
    ) : (
      ''
    );
  }, [options, value]);

  useEffect(() => {
    if (
      options.length > 0 &&
      !options.some((option) => option.value === value)
    ) {
      onChange(options[0].value);
    }
  }, [options, value, onChange]);

  return (
    <div className="form-control flex flex-col justify-center mb-3">
      <div className="font-bold mb-1 md:hidden">{field.label || configKey}</div>
      <label
        className={classNames({
          'input input-bordered join-item grow flex items-center gap-2 mb-1': true,
          'bg-base-200': disabled,
        })}
      >
        <div className="font-bold hidden md:block">
          {field.label || configKey}
        </div>

        <Dropdown
          className="grow"
          entity={configKey}
          options={options}
          filterable={filterable}
          optionsSize={filterable ? 'small' : 'medium'}
          currentValue={selectedValue}
          renderOption={renderOption}
          isSelected={(option) => value === option.value}
          onSelect={(option) => onChange(option.value)}
        />
      </label>

      {field.note && (
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </div>
  );
};

const SettingsSectionLabel: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="mb-2">
    <h4>{children}</h4>
  </div>
);

const DelimeterComponent: React.FC = () => (
  <div className="pb-3" aria-label="delimeter" />
);

const ThemeController: FC = () => {
  const { lang } = useLang();
  const dataThemes = ['auto', ...THEMES].map((theme) => ({
    value: theme,
    label: theme,
  }));
  const syntaxThemes = ['auto', ...SYNTAX_THEMES].map((theme) => ({
    value: theme,
    label: theme,
  }));

  const { currentTheme, switchTheme, currentSyntaxTheme, switchSyntaxTheme } =
    useAppContext();

  const selectedThemeValue = useMemo(
    () => (
      <div className="flex gap-2 items-center ml-2">
        <span
          data-theme={currentTheme}
          className="bg-base-100 grid shrink-0 grid-cols-2 gap-1 rounded-md p-1 shadow-sm"
        >
          <div className="bg-base-content size-1 rounded-full"></div>{' '}
          <div className="bg-primary size-1 rounded-full"></div>{' '}
          <div className="bg-secondary size-1 rounded-full"></div>{' '}
          <div className="bg-accent size-1 rounded-full"></div>
        </span>
        <span className="truncate text-left">{currentTheme}</span>
      </div>
    ),
    [currentTheme]
  );
  const renderThemeOption = (option: DropdownOption) => (
    <div className="flex gap-2 items-center">
      <span
        data-theme={option.value}
        className="bg-base-100 grid shrink-0 grid-cols-2 gap-0.5 rounded-md p-1 shadow-sm"
      >
        <div className="bg-base-content size-1 rounded-full"></div>{' '}
        <div className="bg-primary size-1 rounded-full"></div>{' '}
        <div className="bg-secondary size-1 rounded-full"></div>{' '}
        <div className="bg-accent size-1 rounded-full"></div>
      </span>
      <span className="truncate text-left">{option.label}</span>
    </div>
  );

  /* theme controller is copied from https://daisyui.com/components/theme-controller/ */
  return (
    <>
      {/* UI theme */}
      <div className="form-control flex flex-col justify-center mb-3">
        <div className="font-bold mb-1 md:hidden">
          {lang.settings.themeManager.dataTheme.label}
        </div>
        <label className="input input-bordered join-item grow flex items-center gap-2 mb-1">
          <div className="font-bold hidden md:block">
            {lang.settings.themeManager.dataTheme.label}
          </div>

          <Dropdown
            className="grow"
            entity="theme"
            options={dataThemes}
            currentValue={selectedThemeValue}
            renderOption={renderThemeOption}
            isSelected={(option) => currentTheme === option.value}
            onSelect={(option) => switchTheme(option.value)}
          />
        </label>
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{
            __html: lang.settings.themeManager.dataTheme.note,
          }}
        />
      </div>

      {/* Code blocks theme */}
      <div className="form-control flex flex-col justify-center mb-3">
        <div className="font-bold mb-1 md:hidden">
          {lang.settings.themeManager.syntaxTheme.label}
        </div>
        <label className="input input-bordered join-item grow flex items-center gap-2 mb-1">
          <div className="font-bold hidden md:block">
            {lang.settings.themeManager.syntaxTheme.label}
          </div>

          <Dropdown
            className="grow"
            entity="theme"
            options={syntaxThemes}
            currentValue={<span>{currentSyntaxTheme}</span>}
            renderOption={(option) => <span>{option.label}</span>}
            isSelected={(option) => currentSyntaxTheme === option.value}
            onSelect={(option) => switchSyntaxTheme(option.value)}
          />
        </label>
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{
            __html: lang.settings.themeManager.syntaxTheme.note,
          }}
        />
      </div>
    </>
  );
};

const PresetManager: FC<{
  config: Configuration;
  onLoadConfig: (config: Configuration) => Promise<void>;
  presets: ConfigurationPreset[];
  onSavePreset: (name: string, config: Configuration) => Promise<void>;
  onRemovePreset: (name: string) => Promise<void>;
}> = ({ config, onLoadConfig, presets, onSavePreset, onRemovePreset }) => {
  const { lang } = useLang();
  const { showConfirm, showPrompt } = useModals();

  const handleSavePreset = async () => {
    const newPresetName = (
      (await showPrompt('Enter a new preset name')) || ''
    ).trim();
    if (newPresetName === '') return;

    const existingPreset = presets.find((p) => p.name === newPresetName);
    if (
      !existingPreset ||
      (await showConfirm(
        `Preset "${newPresetName}" already exists, overwrite it?`
      ))
    ) {
      await onSavePreset(newPresetName, config);
    }
  };

  const handleRenamePreset = async (preset: ConfigurationPreset) => {
    const newPresetName = ((await showPrompt('Enter a new name')) || '').trim();
    if (newPresetName === '') return;

    await onRemovePreset(preset.name);
    await onSavePreset(
      newPresetName,
      Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFAULT)), preset.config)
    );
  };

  const handleLoadPreset = async (preset: ConfigurationPreset) => {
    if (
      await showConfirm(
        `Load preset "${preset.name}"? Current settings will be replaced.`
      )
    ) {
      await onLoadConfig(
        Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFAULT)), preset.config)
      );
    }
  };

  const handleDeletePreset = async (preset: ConfigurationPreset) => {
    if (await showConfirm(`Delete preset "${preset.name}"?`)) {
      await onRemovePreset(preset.name);
    }
  };

  return (
    <>
      {/* Save new preset */}
      <SettingsSectionLabel>
        {lang.settings.presetManager.newPreset.title}
      </SettingsSectionLabel>

      <button
        className="btn btn-neutral max-w-80 mb-4"
        onClick={handleSavePreset}
        title="Save new preset"
        aria-label="Save new preset"
      >
        <CloudArrowUpIcon className="w-5 h-5" />
        {lang.settings.presetManager.newPreset.saveBtnLabel}
      </button>

      {/* List of saved presets */}
      <SettingsSectionLabel>
        {lang.settings.presetManager.savedPresets.title}
      </SettingsSectionLabel>

      {presets.length === 0 && (
        <div
          className="text-xs opacity-75 max-w-80"
          dangerouslySetInnerHTML={{
            __html: lang.settings.presetManager.savedPresets.noPresetFound,
          }}
        />
      )}

      {presets.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {presets
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((preset) => (
              <div key={preset.id} className="card bg-base-200 p-3">
                <div className="flex items-center">
                  <div className="grow">
                    <h4 className="font-medium">{preset.name}</h4>
                    <p className="text-xs opacity-40">
                      Created: {dateFormatter.format(preset.createdAt)}
                    </p>
                  </div>

                  <div className="min-w-18 grid grid-cols-2 gap-2">
                    <button
                      className="btn btn-ghost w-8 h-8 p-0 rounded-full"
                      onClick={() => handleLoadPreset(preset)}
                      title="Load preset"
                      aria-label="Load preset"
                    >
                      <PlayCircleIcon className="w-5 h-5" />
                    </button>

                    {/* dropdown */}
                    <div tabIndex={0} className="dropdown dropdown-end">
                      <button
                        className="btn btn-ghost w-8 h-8 p-0 rounded-full"
                        title="More"
                        aria-label="Show more actions"
                      >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                      </button>

                      {/* dropdown menu */}
                      <ul
                        aria-label="More actions"
                        role="menu"
                        tabIndex={-1}
                        className="dropdown-content menu rounded-box bg-base-100 max-w-60 p-2 shadow-2xl"
                      >
                        <li role="menuitem" tabIndex={0}>
                          <button
                            type="button"
                            onClick={() => handleRenamePreset(preset)}
                            title="Rename preset"
                            aria-label="Rename preset"
                          >
                            <PencilIcon className={ICON_CLASSNAME} />
                            Rename
                          </button>
                        </li>
                        <li role="menuitem" tabIndex={0} className="text-error">
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset)}
                            title="Delete preset"
                            aria-label="Delete preset"
                          >
                            <TrashIcon className={ICON_CLASSNAME} />
                            Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
};

const ImportExportComponent: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { importDB, exportDB } = useAppContext();

  const onExport = async () => {
    const data = await exportDB();
    const conversationJson = JSON.stringify(data, null, 2);
    const blob = new Blob([conversationJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length != 1) return false;
    const data = await files[0].text();
    await importDB(data);
    onClose();
  };

  const debugImportDemoConv = async () => {
    const res = await fetch(
      normalizeUrl('/demo-conversation.json', import.meta.env.BASE_URL)
    );
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.text();
    await importDB(data);
    onClose();
  };

  return (
    <>
      <SettingsSectionLabel>
        <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
        Chats
      </SettingsSectionLabel>

      <div className="grid grid-cols-[repeat(2,max-content)] gap-2">
        <button className="btn" onClick={onExport}>
          <ArrowDownTrayIcon className={ICON_CLASSNAME} />
          Export
        </button>

        <input
          id="file-import"
          type="file"
          accept=".json"
          onInput={onImport}
          hidden
        />
        <label
          htmlFor="file-import"
          className="btn"
          aria-label="Import file"
          tabIndex={0}
          role="button"
        >
          <ArrowUpTrayIcon className={ICON_CLASSNAME} />
          Import
        </label>
      </div>

      <DelimeterComponent />

      <SettingsSectionLabel>
        <EyeIcon className={ICON_CLASSNAME} />
        Technical Demo
      </SettingsSectionLabel>

      <button className="btn" onClick={debugImportDemoConv}>
        Import demo conversation
      </button>
    </>
  );
};
