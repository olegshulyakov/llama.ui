import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCog, LuMenu, LuSquarePen } from 'react-icons/lu';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { useAppContext } from '../context/app';
import { useChatContext } from '../context/chat';
import { useInferenceContext } from '../context/inference';
import { Dropdown } from './common';

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
        <label htmlFor="toggle-drawer" className="btn btn-ghost w-8 h-8 p-0">
          <LuMenu className="lucide h-5 w-5" />
        </label>

        {/* spacer */}
        <label
          className="grow font-medium truncate text-center cursor-pointer px-4"
          aria-label={title}
          role="button"
          onClick={() => {
            if (showSettings) return;
            if (currConv) navigate(`/chat/${currConv.id}`);
            else navigate('/');
          }}
        >
          {title}
        </label>

        {/* new conversation button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          title={t('header.buttons.newConv')}
          aria-label={t('header.ariaLabels.newConv')}
        >
          <LuSquarePen className="lucide w-5 h-5" />
        </Button>
      </section>

      {showSettings && (
        <section className="flex items-center max-xl:hidden">
          <label
            className="font-medium truncate text-center px-4"
            aria-label={title}
          >
            {title}
          </label>
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
              size="icon"
              className="max-xl:hidden"
              title={t('header.buttons.settings')}
              aria-label={t('header.ariaLabels.settings')}
              onClick={() => navigate('/settings')}
            >
              {/* settings button */}
              <LuCog className="lucide w-5 h-5" />
            </Button>
          </div>
        </section>
      )}
    </header>
  );
}
