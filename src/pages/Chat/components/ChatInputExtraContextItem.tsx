import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '../../../components';
import { MessageExtra } from '../../../types';
import { classNames } from '../../../utils';

export default function ChatInputExtraContextItem({
  items,
  removeItem,
  clickToShow,
}: {
  items?: MessageExtra[];
  removeItem?: (index: number) => void;
  clickToShow?: boolean;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(-1);
  const showingItem = show >= 0 ? items?.[show] : undefined;

  if (!items) return null;

  return (
    <div
      className="flex flex-row gap-4 overflow-x-auto py-2 px-1 mb-1"
      role="group"
      aria-description={t('chatInput.ariaLabels.fileItems')}
    >
      {items.map((item, i) => (
        <div
          className="indicator"
          key={i}
          onClick={() => clickToShow && setShow(i)}
          tabIndex={0}
          aria-description={
            clickToShow
              ? t('chatInput.item.clickToShow', { name: item.name })
              : undefined
          }
          role={clickToShow ? 'button' : 'menuitem'}
        >
          {removeItem && (
            <div className="indicator-item indicator-top">
              <Button
                aria-label={t('chatInput.ariaLabels.removeButton')}
                variant="neutral"
                size="icon-small"
                onClick={() => removeItem(i)}
              >
                <Icon icon="LuX" size="xs" />
              </Button>
            </div>
          )}

          <div
            className={classNames({
              'flex flex-row rounded-md shadow-sm items-center m-0 p-0': true,
              'cursor-pointer hover:shadow-md': !!clickToShow,
            })}
          >
            {item.type === 'imageFile' ? (
              <>
                <img
                  src={item.base64Url}
                  alt={`Preview image for ${item.name}`}
                  className="w-14 h-14 object-cover rounded-md"
                />
              </>
            ) : (
              <>
                <div
                  className="w-14 h-14 flex items-center justify-center"
                  aria-description={t('chatInput.ariaLabels.documentIcon')}
                >
                  {item.type === 'audioFile' ? (
                    <Icon
                      icon="LuVolume2"
                      size="xl"
                      className="text-gray-500"
                    />
                  ) : (
                    <Icon
                      icon="LuFileText"
                      size="xl"
                      className="text-gray-500"
                    />
                  )}
                </div>

                <div className="text-xs pr-4">
                  <b>{item.name ?? t('chatInput.item.extraContentName')}</b>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      {showingItem && (
        <dialog
          className="modal modal-open"
          aria-description={t('chatInput.ariaLabels.previewDialog', {
            name: showingItem.name,
          })}
        >
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <b>{showingItem.name ?? t('chatInput.item.extraContentName')}</b>
              <Button
                variant="ghost"
                size="small"
                aria-label={t('chatInput.previewDialog.closeButton')}
              >
                <Icon icon="LuX" size="md" onClick={() => setShow(-1)} />
              </Button>
            </div>
            {showingItem.type === 'imageFile' ? (
              <img
                src={showingItem.base64Url}
                alt={`Preview image for ${showingItem.name}`}
              />
            ) : showingItem.type === 'audioFile' ? (
              <audio
                controls
                className="w-full"
                aria-description={`Audio file ${showingItem.name}`}
              >
                <source
                  src={`data:${showingItem.mimeType};base64,${showingItem.base64Data}`}
                  type={showingItem.mimeType}
                  aria-description={`Audio file ${showingItem.name}`}
                />
                {t('chatInput.previewDialog.audioNotSupported')}
              </audio>
            ) : (
              <div className="overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words text-sm">
                  {showingItem.content}
                </pre>
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setShow(-1)}></div>
        </dialog>
      )}
    </div>
  );
}
