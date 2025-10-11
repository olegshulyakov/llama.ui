import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppContext } from '../store/app';
import { useChatContext } from '../store/chat';
import { useInferenceContext } from '../store/inference';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { Icon } from './Icon';
import { Label } from './Label';

export default function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    config,
    config: { model },
    saveConfig,
    showSettings,
  } = useAppContext();
  const { models } = useInferenceContext();
  const { viewingChat } = useChatContext();

  const currConv = useMemo(() => viewingChat?.conv ?? null, [viewingChat]);
  const title = useMemo(
    () =>
      showSettings
        ? t('header.title.settings')
        : currConv
          ? currConv.name
          : t('header.title.noChat'),
    [t, currConv, showSettings]
  );

  const selectedModel = useMemo(() => {
    const selectedModel = models.find((m) => m.id === model);
    return selectedModel ? selectedModel.name : <s>{model}</s>;
  }, [models, model]);

  return (
    <header className="flex flex-col gap-2 justify-center max-md:pb-2 md:py-2 sticky top-0 z-10">
      <section className="flex flex-row items-center xl:hidden">
        {/* open sidebar button */}
        <Label variant="btn-ghost" size="icon" htmlFor="toggle-drawer">
          <Icon icon="LuMenu" size="md" />
        </Label>

        {/* spacer */}
        <Label
          variant="fake-btn"
          className="grow font-medium truncate px-4"
          aria-label={title}
          role="button"
          onClick={() => {
            if (showSettings) return;
            if (currConv) navigate(`/chat/${currConv.id}`);
            else navigate('/');
          }}
        >
          {title}
        </Label>

        {/* new conversation button */}
        <Button
          variant="ghost"
          size="icon-rounded"
          onClick={() => navigate('/')}
          title={t('header.buttons.newConv')}
          aria-label={t('header.ariaLabels.newConv')}
        >
          <Icon icon="LuSquarePen" size="md" />
        </Button>
      </section>

      {showSettings && (
        <section className="flex items-center max-xl:hidden">
          <Label
            className="font-medium truncate text-center px-4"
            aria-label={title}
          >
            {title}
          </Label>
        </section>
      )}

      {!showSettings && (
        <section className="flex flex-row items-center">
          {/* model information */}
          <Dropdown
            className="ml-2 px-1 xl:px-4 py-0"
            entity="Model"
            options={models.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            filterable={true}
            hideChevron={models.length < 2}
            align="start"
            currentValue={
              <span className="max-w-64 sm:max-w-80 truncate text-nowrap font-semibold">
                {selectedModel}
              </span>
            }
            renderOption={(option) => (
              <span className="max-w-64 sm:max-w-80 truncate text-nowrap">
                {option.label}
              </span>
            )}
            isSelected={(option) => model === option.value}
            onSelect={(option) =>
              saveConfig({
                ...config,
                model: option.value,
              })
            }
          />

          {/* spacer */}
          <div className="grow"></div>

          {/* action buttons (top right) */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-rounded"
              className="max-xl:hidden"
              title={t('header.buttons.settings')}
              aria-label={t('header.ariaLabels.settings')}
              onClick={() => navigate('/settings')}
            >
              {/* settings button */}
              <Icon icon="LuCog" size="md" />
            </Button>
          </div>
        </section>
      )}
    </header>
  );
}
