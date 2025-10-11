import { useTranslation } from 'react-i18next';
import { TbDatabaseExport, TbDatabaseImport } from 'react-icons/tb';
import { DelimeterComponent, SettingsSectionLabel } from '.';
import { Button, Icon, Label } from '../../../components';
import { useAppContext } from '../../../store/app';
import { normalizeUrl } from '../../../utils';
import { downloadAsFile } from '../../../utils/downloadAsFile';

export function ImportExportComponent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { importDB, exportDB } = useAppContext();

  const onExport = async () => {
    return exportDB().then((data) =>
      downloadAsFile([JSON.stringify(data, null, 2)], 'llama-ui-database.json')
    );
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
        <Icon icon="LuMessageCircleMore" size="sm" variant="leftside" />
        {t('settings.importExport.chatsSectionTitle')}
      </SettingsSectionLabel>

      <div className="grid grid-cols-[repeat(2,max-content)] gap-2">
        <Button onClick={onExport}>
          <TbDatabaseExport className="lucide w-4 h-4 mr-1 inline" />
          {t('settings.importExport.exportBtnLabel')}
        </Button>

        <input
          id="file-import"
          type="file"
          accept=".json"
          onInput={onImport}
          hidden
        />
        <Label
          variant="btn"
          htmlFor="file-import"
          aria-label={t('settings.importExport.importBtnLabel')}
          tabIndex={0}
          role="button"
        >
          <TbDatabaseImport className="lucide w-4 h-4 mr-1 inline" />
          {t('settings.importExport.importBtnLabel')}
        </Label>
      </div>

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon icon="LuEye" size="sm" variant="leftside" />
        {t('settings.importExport.technicalDemoSectionTitle')}
      </SettingsSectionLabel>

      <Button onClick={debugImportDemoConv}>
        {t('settings.importExport.importDemoConversationBtnLabel')}
      </Button>
    </>
  );
}
