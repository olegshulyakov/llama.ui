import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Dropdown, Icon } from '../../components';
import { CONFIG_DEFAULT, INFERENCE_PROVIDERS } from '../../config';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import TextToSpeech, {
  getSpeechSynthesisVoiceByName,
  getSpeechSynthesisVoices,
  IS_SPEECH_SYNTHESIS_SUPPORTED,
} from '../../hooks/useTextToSpeech';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useAppContext } from '../../store/app';
import { useChatContext } from '../../store/chat';
import { useInferenceContext } from '../../store/inference';
import { useModals } from '../../store/modal';
import {
  Configuration,
  ConfigurationKey,
  InferenceApiModel,
  InferenceProvidersKey,
  ProviderOption,
} from '../../types';
import {
  DropdownOption,
  SettingField,
  SettingFieldCustom,
  SettingFieldDropdown,
  SettingFieldInput,
  SettingFieldInputType,
  SettingInputType,
  SettingSection,
  SettingTab,
} from '../../types/settings';
import { classNames, isBoolean, isNumeric, isString } from '../../utils';
import {
  DelimeterComponent,
  ImportExportComponent,
  PresetManager,
  SettingsModalCheckbox,
  SettingsModalDropdown,
  SettingsModalLongInput,
  SettingsModalRangeInput,
  SettingsModalShortInput,
  SettingsSectionLabel,
  ThemeController,
} from './components';

// --- Constants ---
const DELIMITER: SettingFieldCustom = {
  type: SettingInputType.CUSTOM,
  key: 'custom',
  component: 'delimeter',
};

// --- Helper Functions ---
function toSection(
  label: string | ReactElement,
  icon?: string | ReactElement
): SettingSection {
  return {
    type: SettingInputType.SECTION,
    label: (
      <>
        {icon}
        {label}
      </>
    ),
  };
}

function toInput(
  type: SettingFieldInputType,
  key: ConfigurationKey,
  disabled: boolean = false,
  additional?: Record<string, unknown>
): SettingFieldInput {
  return {
    type,
    disabled,
    key,
    ...additional,
  };
}

function toDropdown(
  key: ConfigurationKey,
  options: DropdownOption[],
  filterable: boolean = false,
  disabled: boolean = false
): SettingFieldDropdown {
  return {
    type: SettingInputType.DROPDOWN,
    key,
    disabled,
    options,
    filterable,
  };
}

// --- Setting Tabs Configuration ---
function getSettingTabsConfiguration(
  config: Configuration,
  models: InferenceApiModel[],
  t: ReturnType<typeof useTranslation>['t']
): SettingTab[] {
  return [
    /* General */
    {
      title: (
        <>
          <Icon icon="LuSettings" size="sm" variant="leftside" />
          {t('settings.tabs.general')}
        </>
      ),
      fields: [
        toSection(t('settings.sections.inferenceProvider')),
        toDropdown(
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
          SettingInputType.SHORT_INPUT,
          'baseUrl',
          !INFERENCE_PROVIDERS[config.provider]?.allowCustomBaseUrl
        ),
        toInput(SettingInputType.SHORT_INPUT, 'apiKey'),
        toDropdown(
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
          component: () => null,
        },

        DELIMITER,
        DELIMITER,
        toInput(SettingInputType.LONG_INPUT, 'systemMessage'),
      ],
    },

    /* UI */
    {
      title: (
        <>
          <Icon icon="LuMonitor" size="sm" variant="leftside" />
          {t('settings.tabs.ui')}
        </>
      ),
      fields: [
        toSection(
          t('settings.sections.userInterface'),
          <Icon icon="LuMonitor" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.SHORT_INPUT, 'initials'),
        {
          type: SettingInputType.CUSTOM,
          key: 'language',
          component: () => null,
        },
        {
          type: SettingInputType.CUSTOM,
          key: 'theme-manager',
          component: () => null,
        },
        toInput(SettingInputType.CHECKBOX, 'showRawUserMessage'),
        toInput(SettingInputType.CHECKBOX, 'showRawAssistantMessage'),
      ],
    },

    /* Voice */
    {
      title: (
        <>
          <Icon icon="LuAudioLines" size="sm" variant="leftside" />
          {t('settings.tabs.voice')}
        </>
      ),
      fields: [
        /* Text to Speech */
        toSection(
          t('settings.sections.textToSpeech'),
          <Icon icon="LuSpeech" size="sm" variant="leftside" />
        ),
        toDropdown(
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
              text={t('settings.textToSpeech.check.text')}
              voice={getSpeechSynthesisVoiceByName(config.ttsVoice)}
              pitch={config.ttsPitch}
              rate={config.ttsRate}
              volume={config.ttsVolume}
            >
              {({ isPlaying, play, stop }) => (
                <Button
                  onClick={() => (!isPlaying ? play() : stop())}
                  disabled={!IS_SPEECH_SYNTHESIS_SUPPORTED}
                  title="Play test message"
                  aria-label="Play test message"
                >
                  {!isPlaying && (
                    <Icon icon="LuVolume2" size="sm" variant="leftside" />
                  )}
                  {isPlaying && (
                    <Icon icon="LuVolumeX" size="sm" variant="leftside" />
                  )}
                  {t('settings.textToSpeech.check.label')}
                </Button>
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
          <Icon icon="LuMessagesSquare" size="sm" variant="leftside" />
          {t('settings.tabs.conversations')}
        </>
      ),
      fields: [
        toSection(
          t('settings.sections.chat'),
          <Icon icon="LuMessageCircleMore" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.SHORT_INPUT, 'pasteLongTextToFileLen'),
        toInput(SettingInputType.CHECKBOX, 'pdfAsImage'),

        /* Performance */
        DELIMITER,
        toSection(
          t('settings.sections.performance'),
          <Icon icon="LuRocket" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.CHECKBOX, 'showTokensPerSecond'),

        /* Reasoning */
        DELIMITER,
        toSection(
          t('settings.sections.reasoning'),
          <Icon icon="LuBrain" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.CHECKBOX, 'showThoughtInProgress'),
        toInput(SettingInputType.CHECKBOX, 'excludeThoughtOnReq'),
      ],
    },

    /* Presets */
    {
      title: (
        <>
          <Icon icon="LuBookmark" size="sm" variant="leftside" />
          {t('settings.tabs.presets')}
        </>
      ),
      fields: [
        {
          type: SettingInputType.CUSTOM,
          key: 'preset-manager',
          component: () => null,
        },
      ],
    },

    /* Import/Export */
    {
      title: (
        <>
          <Icon icon="LuDatabase" size="sm" variant="leftside" />
          {t('settings.tabs.importExport')}
        </>
      ),
      fields: [
        {
          type: SettingInputType.CUSTOM,
          key: 'import-export',
          component: () => null,
        },
      ],
    },

    /* Advanced */
    {
      title: (
        <>
          <Icon icon="LuGrid2X2Plus" size="sm" variant="leftside" />
          {t('settings.tabs.advanced')}
        </>
      ),
      fields: [
        /* Generation */
        toSection(
          t('settings.sections.generation'),
          <Icon icon="LuCog" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.CHECKBOX, 'overrideGenerationOptions'),
        ...['temperature', 'top_k', 'top_p', 'min_p', 'max_tokens'].map((key) =>
          toInput(
            SettingInputType.SHORT_INPUT,
            key as ConfigurationKey,
            !config['overrideGenerationOptions']
          )
        ),

        /* Samplers */
        DELIMITER,
        toSection(
          t('settings.sections.samplers'),
          <Icon icon="LuFilter" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.CHECKBOX, 'overrideSamplersOptions'),
        ...[
          'samplers',
          'dynatemp_range',
          'dynatemp_exponent',
          'typical_p',
          'xtc_probability',
          'xtc_threshold',
        ].map((key) =>
          toInput(
            SettingInputType.SHORT_INPUT,
            key as ConfigurationKey,
            !config['overrideSamplersOptions']
          )
        ),

        /* Penalties */
        DELIMITER,
        toSection(
          t('settings.sections.penalties'),
          <Icon icon="LuHand" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.CHECKBOX, 'overridePenaltyOptions'),
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
            SettingInputType.SHORT_INPUT,
            key as ConfigurationKey,
            !config['overridePenaltyOptions']
          )
        ),

        /* Custom */
        DELIMITER,
        toSection(
          t('settings.sections.custom'),
          <Icon icon="LuCpu" size="sm" variant="leftside" />
        ),
        toInput(SettingInputType.LONG_INPUT, 'custom'),
      ],
    },

    /* Experimental */
    {
      title: (
        <>
          <Icon icon="LuFlaskConical" size="sm" variant="leftside" />
          <Trans i18nKey="settings.sections.experimental" />
        </>
      ),
      fields: [
        {
          type: SettingInputType.CUSTOM,
          key: 'custom', // dummy key, won't be used
          component: () => (
            <div
              className="flex flex-col gap-2 mb-8"
              dangerouslySetInnerHTML={{
                __html: t('settings.parameters.experimental.note'),
              }}
            />
          ),
        },
        toInput(SettingInputType.CHECKBOX, 'pyIntepreterEnabled'),
      ],
    },
  ];
}

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
    () => getSettingTabsConfiguration(localConfig, localModels, t),
    [t, localConfig, localModels]
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
            field={field}
            value={localConfig[field.key] as string | number}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.RANGE_INPUT:
        return (
          <SettingsModalRangeInput
            key={key}
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
            field={field}
            value={String(localConfig[field.key])}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.CHECKBOX:
        return (
          <SettingsModalCheckbox
            key={key}
            field={field}
            value={!!localConfig[field.key]}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.DROPDOWN:
        return (
          <SettingsModalDropdown
            key={key}
            field={field as SettingFieldInput}
            options={(field as SettingFieldDropdown).options}
            filterable={(field as SettingFieldDropdown).filterable}
            value={String(localConfig[field.key])}
            onChange={onChange(field.key)}
          />
        );
      case SettingInputType.CUSTOM:
        switch (field.key) {
          case 'language':
            return (
              <SettingsModalDropdown
                key="language"
                field={{
                  type: SettingInputType.DROPDOWN,
                  key: 'custom',
                  translateKey: 'language',
                }}
                options={SUPPORTED_LANGUAGES.map((lang) => ({
                  value: lang.key,
                  label: lang.label,
                }))}
                value={i18n.language}
                onChange={(lang) => {
                  i18n.changeLanguage(lang as string);
                  document.documentElement.setAttribute('lang', lang as string);
                }}
              />
            );
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
              <Button
                key={key}
                onClick={() =>
                  fetchModels(localConfig).then((models) =>
                    setLocalModels(models)
                  )
                }
              >
                <Icon icon="LuRefreshCw" size="sm" variant="leftside" />
                <Trans i18nKey="settings.actionButtons.fetchModels" />
              </Button>
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
            <Button
              key={idx}
              variant="ghost"
              className={classNames({
                'justify-start font-normal w-44 mb-1': true,
                'btn-active': tabIdx === idx,
              })}
              onClick={() => setTabIdx(idx)}
              dir="auto"
            >
              {tab.title}
            </Button>
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
            <Trans
              i18nKey="settings.footer.version"
              values={{ version: import.meta.env.PACKAGE_VERSION }}
            />
            <br />
            <Trans i18nKey="settings.footer.storageNote" />
          </p>
        </div>
      </div>

      <div className="sticky bottom-4 flex gap-2 max-md:justify-center mt-4">
        <div className="hidden md:block w-54 h-10" />
        <Button variant="neutral" onClick={() => handleSave(localConfig)}>
          <Trans i18nKey="settings.actionButtons.saveBtnLabel" />
        </Button>
        <Button onClick={onClose}>
          <Trans i18nKey="settings.actionButtons.cancelBtnLabel" />
        </Button>
        <Button onClick={resetConfig}>
          <Trans i18nKey="settings.actionButtons.resetBtnLabel" />
        </Button>
      </div>
    </div>
  );
}
