import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LuSpeech, LuVolume2 } from 'react-icons/lu';
import { Button, Dropdown, Icon, Label } from '../../../components';
import {
  IS_SPEECH_SYNTHESIS_SUPPORTED,
  getSpeechSynthesisVoiceByName,
  getSpeechSynthesisVoices,
} from '../../../hooks/useTextToSpeech';
import { Configuration, ConfigurationKey } from '../../../types';
import { SettingInputType } from '../../../types/settings';
import {
  SettingsModalDropdown,
  SettingsModalRangeInput,
  SettingsSectionLabel,
} from './';

interface VoiceManagerProps {
  config: Configuration;
  handleChange: (
    key: ConfigurationKey
  ) => (value: string | number | boolean) => void;
}

export function VoiceManager({ config, handleChange }: VoiceManagerProps) {
  const { t } = useTranslation();

  const [testMessage, setTestMessage] = useState(
    t('settings.textToSpeech.testText')
  );

  const availableVoices = IS_SPEECH_SYNTHESIS_SUPPORTED
    ? getSpeechSynthesisVoices().map((voice) => ({
        value: `${voice.name} (${voice.lang})`,
        label: `${voice.name} (${voice.lang})`,
      }))
    : [];

  const handleTestMessageChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setTestMessage(e.target.value);
  };

  const playBrowserTts = () => {
    if (!IS_SPEECH_SYNTHESIS_SUPPORTED) return;

    const utterance = new SpeechSynthesisUtterance(testMessage);
    const voice = getSpeechSynthesisVoiceByName(config.ttsVoice);

    if (voice) {
      utterance.voice = voice;
    }
    utterance.pitch = config.ttsPitch;
    utterance.rate = config.ttsRate;
    utterance.volume = config.ttsVolume;

    speechSynthesis.speak(utterance);
  };

  const playModelTts = async () => {
    try {
      // Check if we have the necessary configuration for provider TTS
      if (config.ttsMode !== 'provider') {
        console.warn('Provider TTS is not enabled');
        return;
      }

      alert(t('settings.textToSpeech.modelTtsNotImplemented'));
    } catch (error) {
      console.error('Error with provider TTS:', error);
    }
  };

  // Determine which play function to use based on provider
  const handlePlayTest = () => {
    if (config.ttsMode === 'provider') {
      playModelTts();
    } else {
      playBrowserTts();
    }
  };

  return (
    <>
      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuSpeech />
        </Icon>
        <Trans i18nKey="settings.sections.textToSpeech" />
      </SettingsSectionLabel>

      {/* TTS Mode Settings */}
      <div className="form-control flex flex-col justify-center mb-3">
        <div className="font-bold mb-1 md:hidden">
          <Trans i18nKey="settings.textToSpeech.modeLabel" />
        </div>
        <Label variant="input-bordered" className="mb-1">
          <div className="font-bold hidden md:block">
            <Trans i18nKey="settings.textToSpeech.modeLabel" />
          </div>

          <Dropdown
            className="grow"
            entity="ttsMode"
            options={[
              {
                value: 'browser',
                label: t('settings.textToSpeech.mode.browser'),
              },
              {
                value: 'provider',
                label: t('settings.textToSpeech.mode.provider'),
              },
            ]}
            currentValue={
              <span>
                <Trans
                  i18nKey={`settings.textToSpeech.mode.${config.ttsMode}`}
                />
              </span>
            }
            renderOption={(option) => <span>{option.label}</span>}
            isSelected={(option) => config.ttsMode === option.value}
            onSelect={(option) => handleChange('ttsMode')(option.value)}
          />
        </Label>
        <div className="text-xs opacity-75 max-w-80">
          <Trans i18nKey="settings.textToSpeech.modeNote" />
        </div>
      </div>

      {/* Browser TTS Settings */}
      {config.ttsMode === 'browser' && (
        <>
          {IS_SPEECH_SYNTHESIS_SUPPORTED ? (
            <>
              <SettingsModalDropdown
                field={{
                  type: SettingInputType.DROPDOWN,
                  key: 'ttsVoice',
                  translateKey: 'ttsVoice',
                }}
                options={availableVoices}
                filterable={true}
                value={config.ttsVoice}
                onChange={handleChange('ttsVoice')}
              />

              <SettingsModalRangeInput
                field={{
                  type: SettingInputType.RANGE_INPUT,
                  key: 'ttsPitch',
                  translateKey: 'ttsPitch',
                }}
                value={config.ttsPitch}
                min={0}
                max={2}
                step={0.5}
                onChange={handleChange('ttsPitch')}
              />

              <SettingsModalRangeInput
                field={{
                  type: SettingInputType.RANGE_INPUT,
                  key: 'ttsRate',
                  translateKey: 'ttsRate',
                }}
                value={config.ttsRate}
                min={0.5}
                max={2}
                step={0.5}
                onChange={handleChange('ttsRate')}
              />

              <SettingsModalRangeInput
                field={{
                  type: SettingInputType.RANGE_INPUT,
                  key: 'ttsVolume',
                  translateKey: 'ttsVolume',
                }}
                value={config.ttsVolume}
                min={0}
                max={1}
                step={0.25}
                onChange={handleChange('ttsVolume')}
              />
            </>
          ) : (
            <div className="text-sm text-error mb-3">
              <Trans i18nKey="settings.textToSpeech.browserNotSupported" />
            </div>
          )}
        </>
      )}

      {/* Provider TTS Settings */}
      {config.ttsMode === 'provider' && <></>}

      {/* Test Section */}
      <SettingsSectionLabel>
        <Trans i18nKey="settings.textToSpeech.testSpeech" />
      </SettingsSectionLabel>

      <Label variant="form-control" className="max-w-80 mb-3">
        <textarea
          value={testMessage}
          onChange={handleTestMessageChange}
          className="textarea textarea-bordered w-full max-w-80 h-24"
          placeholder={t('settings.textToSpeech.testTextPlaceholder')}
        />
      </Label>

      <Button
        onClick={handlePlayTest}
        disabled={
          (config.ttsMode === 'browser' && !IS_SPEECH_SYNTHESIS_SUPPORTED) ||
          (config.ttsMode === 'provider' && false)
        }
        title={t('settings.textToSpeech.title.play')}
        aria-label={t('settings.textToSpeech.ariaLabels.play')}
      >
        <Icon size="sm" variant="leftside">
          <LuVolume2 />
        </Icon>
        <Trans i18nKey="settings.textToSpeech.buttons.play" />
      </Button>
    </>
  );
}
