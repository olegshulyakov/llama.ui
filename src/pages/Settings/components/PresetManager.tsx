import { Trans, useTranslation } from 'react-i18next';
import { SettingsSectionLabel } from '.';
import { Button, Icon } from '../../../components';
import { CONFIG_DEFAULT } from '../../../config';
import { useModals } from '../../../store/modal';
import { Configuration, ConfigurationPreset } from '../../../types';
import { dateFormatter } from '../../../utils';

export function PresetManager({
  config,
  onLoadConfig,
  presets,
  onSavePreset,
  onRemovePreset,
}: {
  config: Configuration;
  onLoadConfig: (config: Configuration) => Promise<void>;
  presets: ConfigurationPreset[];
  onSavePreset: (name: string, config: Configuration) => Promise<void>;
  onRemovePreset: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { showConfirm, showPrompt } = useModals();

  const handleSavePreset = async () => {
    const newPresetName = (
      (await showPrompt(
        t('settings.presetManager.modals.enterNewPresetName')
      )) || ''
    ).trim();
    if (newPresetName === '') return;

    const existingPreset = presets.find((p) => p.name === newPresetName);
    if (
      !existingPreset ||
      (await showConfirm(
        t('settings.presetManager.modals.presetAlreadyExists', {
          presetName: newPresetName,
        })
      ))
    ) {
      await onSavePreset(newPresetName, config);
    }
  };

  const handleRenamePreset = async (preset: ConfigurationPreset) => {
    const newPresetName = (
      (await showPrompt(t('settings.presetManager.modals.enterNewName'))) || ''
    ).trim();
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
        t('settings.presetManager.modals.loadPresetConfirm', {
          presetName: preset.name,
        })
      )
    ) {
      await onLoadConfig(
        Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFAULT)), preset.config)
      );
    }
  };

  const handleDeletePreset = async (preset: ConfigurationPreset) => {
    if (
      await showConfirm(
        t('settings.presetManager.modals.deletePresetConfirm', {
          presetName: preset.name,
        })
      )
    ) {
      await onRemovePreset(preset.name);
    }
  };

  return (
    <>
      {/* Save new preset */}
      <SettingsSectionLabel>
        <Trans i18nKey="settings.presetManager.newPreset" />
      </SettingsSectionLabel>

      <Button
        variant="neutral"
        className="max-w-80 mb-4"
        onClick={handleSavePreset}
        title={t('settings.presetManager.buttons.save')}
        aria-label={t('settings.presetManager.ariaLabels.save')}
      >
        <Icon icon="LuSave" size="md" />
        <Trans i18nKey="settings.presetManager.buttons.save" />
      </Button>

      {/* List of saved presets */}
      <SettingsSectionLabel>
        <Trans i18nKey="settings.presetManager.savedPresets" />
      </SettingsSectionLabel>

      {presets.length === 0 && (
        <div className="text-xs opacity-75 max-w-80">
          <Trans i18nKey="settings.presetManager.noPresetFound" />
        </div>
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
                      {t('settings.presetManager.labels.created')}{' '}
                      {dateFormatter.format(preset.createdAt)}
                    </p>
                  </div>

                  <div className="min-w-18 grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      size="icon-rounded"
                      onClick={() => handleLoadPreset(preset)}
                      title={t('settings.presetManager.buttons.load')}
                      aria-label={t('settings.presetManager.ariaLabels.load')}
                    >
                      <Icon icon="LuCirclePlay" size="md" />
                    </Button>

                    {/* dropdown */}
                    <div tabIndex={0} className="dropdown dropdown-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('settings.presetManager.buttons.more')}
                        aria-label={t('settings.presetManager.ariaLabels.more')}
                      >
                        <Icon icon="LuEllipsisVertical" size="md" />
                      </Button>

                      {/* dropdown menu */}
                      <ul
                        aria-label="More actions"
                        role="menu"
                        tabIndex={-1}
                        className="dropdown-content menu rounded-box bg-base-100 max-w-60 p-2 shadow-2xl"
                      >
                        <li role="menuitem" tabIndex={0}>
                          <Button
                            variant="menu-item"
                            onClick={() => handleRenamePreset(preset)}
                            title={t('settings.presetManager.buttons.rename')}
                            aria-label={t(
                              'settings.presetManager.ariaLabels.rename'
                            )}
                          >
                            <Icon
                              icon="LuPencil"
                              size="sm"
                              variant="leftside"
                            />
                            {t('settings.presetManager.buttons.rename')}
                          </Button>
                        </li>
                        <li role="menuitem" tabIndex={0} className="text-error">
                          <Button
                            variant="menu-item"
                            onClick={() => handleDeletePreset(preset)}
                            title={t('settings.presetManager.buttons.delete')}
                            aria-label={t(
                              'settings.presetManager.ariaLabels.delete'
                            )}
                          >
                            <Icon icon="LuTrash" size="sm" variant="leftside" />
                            {t('settings.presetManager.buttons.delete')}
                          </Button>
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
}
