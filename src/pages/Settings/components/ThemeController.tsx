import { useMemo } from 'react';
import { Trans } from 'react-i18next';
import { Dropdown, DropdownOption, Label } from '../../../components';
import { SYNTAX_THEMES, THEMES } from '../../../config';
import { useAppContext } from '../../../store/app';

export function ThemeController() {
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
          <Trans i18nKey="settings.themeManager.dataTheme.label" />
        </div>
        <Label variant="input-bordered">
          <div className="font-bold hidden md:block">
            <Trans i18nKey="settings.themeManager.dataTheme.label" />
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
        </Label>
        <div className="text-xs opacity-75 max-w-80">
          <Trans i18nKey="settings.themeManager.dataTheme.note" />
        </div>
      </div>

      {/* Code blocks theme */}
      <div className="form-control flex flex-col justify-center mb-3">
        <div className="font-bold mb-1 md:hidden">
          <Trans i18nKey="settings.themeManager.syntaxTheme.label" />
        </div>
        <Label variant="input-bordered">
          <div className="font-bold hidden md:block">
            <Trans i18nKey="settings.themeManager.syntaxTheme.label" />
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
        </Label>
        <div className="text-xs opacity-75 max-w-80">
          <Trans i18nKey="settings.themeManager.syntaxTheme.note" />
        </div>
      </div>
    </>
  );
}
