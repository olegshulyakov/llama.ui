import {
  Download,
  MoreVertical,
  Pencil,
  SquarePen,
  Trash,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useChatContext } from '../context/chat';
import { useModals } from '../context/modal';
import StorageUtils from '../database';
import { Conversation } from '../types';
import { classNames } from '../utils';

export default function Sidebar() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toggleDrawerRef = useRef<HTMLInputElement>(null);

  const { viewingChat, isGenerating } = useChatContext();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const currConv = useMemo(() => viewingChat?.conv ?? null, [viewingChat]);

  useEffect(() => {
    const handleConversationChange = async () => {
      setConversations(await StorageUtils.getAllConversations());
    };
    StorageUtils.onConversationChanged(handleConversationChange);
    handleConversationChange();
    return () => {
      StorageUtils.offConversationChanged(handleConversationChange);
    };
  }, []);
  const { showConfirm, showPrompt } = useModals();

  const groupedConv = useMemo(
    () => groupConversationsByDate(conversations, i18n.language),
    [i18n.language, conversations]
  );

  return (
    <>
      <input
        id="toggle-drawer"
        type="checkbox"
        className="drawer-toggle"
        ref={toggleDrawerRef}
        aria-label="Toggle sidebar"
      />

      <div
        className="drawer-side fixed inset-0 w-full z-50"
        role="complementary"
        aria-label="Sidebar"
        tabIndex={0}
      >
        <div className="flex flex-col bg-base-300 h-full min-h-0 max-w-full xl:w-72 pb-4 px-4 xl:pl-2 xl:pr-0">
          <div className="flex flex-row items-center justify-between xl:py-2">
            {/* close sidebar button */}
            <label className="w-8 h-8 p-0 max-xl:hidden"></label>
            <label
              htmlFor="toggle-drawer"
              className="btn btn-ghost w-8 h-8 p-0 rounded-full xl:hidden"
              title={t('sidebar.buttons.closeSideBar')}
              aria-label={t('sidebar.buttons.closeSideBar')}
              role="button"
              tabIndex={0}
            >
              <X className="w-5 h-5" />
            </label>

            <label
              className="font-bold tracking-wider leading-8 text-center cursor-pointer"
              aria-label={import.meta.env.VITE_APP_NAME}
              role="button"
              onClick={() => navigate('/')}
            >
              {import.meta.env.VITE_APP_NAME}
            </label>

            {/* new conversation button */}
            <button
              className="btn btn-ghost w-8 h-8 p-0 rounded-full"
              onClick={() => navigate('/')}
              title={t('header.buttons.newConv')}
              aria-label={t('header.ariaLabels.newConv')}
            >
              <SquarePen className="w-5 h-5" />
            </button>
          </div>

          {/* scrollable conversation list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {groupedConv.map((group, i) => (
              <div key={i} role="group">
                {/* group name (by date) */}
                {/* we use btn class here to make sure that the padding/margin are aligned with the other items */}
                <b
                  className="btn btn-ghost btn-xs bg-none btn-disabled block text-xs text-base-content text-start px-2 mb-0 mt-6 font-bold opacity-75"
                  role="note"
                  aria-description={t(`sidebar.groups.${group.title}`, {
                    defaultValue: group.title,
                  })}
                  tabIndex={0}
                >
                  <Trans
                    i18nKey={`sidebar.groups.${group.title}`}
                    defaults={group.title}
                  />
                </b>

                {group.conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isCurrConv={currConv?.id === conv.id}
                    onSelect={() => {
                      const toggle = toggleDrawerRef.current;
                      if (toggle != null) {
                        toggle.click();
                      }
                      navigate(`/chat/${conv.id}`);
                    }}
                    onDelete={async () => {
                      if (isGenerating(conv.id)) {
                        toast.error(t('sidebar.errors.deleteOnGenerate'));
                        return;
                      }
                      if (
                        await showConfirm(t('sidebar.actions.deleteConfirm'))
                      ) {
                        toast.success(t('sidebar.actions.deleteSuccess'));
                        StorageUtils.deleteConversation(conv.id);
                        navigate('/');
                      }
                    }}
                    onDownload={async () => {
                      if (isGenerating(conv.id)) {
                        toast.error(t('sidebar.errors.downloadOnGenerate'));
                        return;
                      }
                      const data = await StorageUtils.exportDB(conv.id);
                      const conversationJson = JSON.stringify(data, null, 2);
                      const blob = new Blob([conversationJson], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `conversation_${conv.id}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    onRename={async () => {
                      if (isGenerating(conv.id)) {
                        toast.error(t('sidebar.errors.renameOnGenerate'));
                        return;
                      }
                      const newName = await showPrompt(
                        t('sidebar.actions.newName'),
                        conv.name
                      );
                      if (newName && newName.trim().length > 0) {
                        StorageUtils.updateConversationName(conv.id, newName);
                      }
                    }}
                    t={t}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Footer always at the bottom */}
          <div className="text-center text-xs opacity-75 mx-4 pt-4">
            <Trans i18nKey="sidebar.storageNote" />
          </div>
        </div>
      </div>
    </>
  );
}

function ConversationItem({
  conv,
  isCurrConv,
  onSelect,
  onDelete,
  onDownload,
  onRename,
  t,
}: {
  conv: Conversation;
  isCurrConv: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onRename: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div
      role="menuitem"
      tabIndex={0}
      aria-label={conv.name}
      className={classNames({
        'group flex flex-row btn btn-ghost h-9 justify-start items-center font-normal px-2 xl:pr-0': true,
        'btn-soft': isCurrConv,
      })}
    >
      <button
        key={conv.id}
        className="w-full overflow-hidden truncate text-start"
        onClick={onSelect}
        dir="auto"
        type="button"
        title={conv.name}
        aria-label={t('sidebar.ariaLabels.select', { name: conv.name })}
      >
        {conv.name}
      </button>

      <div tabIndex={0} className="dropdown dropdown-end h-5">
        <button
          // on mobile, we always show the ellipsis icon
          // on desktop, we only show it when the user hovers over the conversation item
          // we use opacity instead of hidden to avoid layout shift
          className="cursor-pointer opacity-100 xl:opacity-20 group-hover:opacity-100"
          onClick={() => {}}
          title={t('sidebar.buttons.more')}
          aria-label={t('sidebar.ariaLabels.more')}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        {/* dropdown menu */}
        <ul
          aria-label={t('sidebar.ariaLabels.dropdown')}
          role="menu"
          tabIndex={-1}
          className="dropdown-content menu bg-base-100 rounded-box z-[1] p-2 shadow"
        >
          <li role="menuitem" tabIndex={0} onClick={onRename}>
            <button
              type="button"
              title={t('sidebar.buttons.rename')}
              aria-label={t('sidebar.ariaLabels.rename')}
            >
              <Pencil className="w-4 h-4" />
              <Trans i18nKey="sidebar.buttons.rename" />
            </button>
          </li>
          <li role="menuitem" tabIndex={0} onClick={onDownload}>
            <button
              type="button"
              title={t('sidebar.buttons.download')}
              aria-label={t('sidebar.ariaLabels.download')}
            >
              <Download className="w-4 h-4" />
              <Trans i18nKey="sidebar.buttons.download" />
            </button>
          </li>
          <li
            role="menuitem"
            tabIndex={0}
            className="text-error"
            onClick={onDelete}
          >
            <button
              type="button"
              title={t('sidebar.buttons.delete')}
              aria-label={t('sidebar.ariaLabels.delete')}
            >
              <Trash className="w-4 h-4" />
              <Trans i18nKey="sidebar.buttons.delete" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

// WARN: vibe code below

export interface GroupedConversations {
  title?: string;
  conversations: Conversation[];
}

// TODO @ngxson : add test for this function
// Group conversations by date
// - "Previous 7 Days"
// - "Previous 30 Days"
// - "Month Year" (e.g., "April 2023")
export function groupConversationsByDate(
  conversations: Conversation[],
  language: string = 'default'
): GroupedConversations[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const groups: { [key: string]: Conversation[] } = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
  };
  const monthlyGroups: { [key: string]: Conversation[] } = {}; // Key format: "Month Year" e.g., "April 2023"

  // Sort conversations by lastModified date in descending order (newest first)
  // This helps when adding to groups, but the final output order of groups is fixed.
  const sortedConversations = [...conversations].sort(
    (a, b) => b.lastModified - a.lastModified
  );

  for (const conv of sortedConversations) {
    const convDate = new Date(conv.lastModified);

    if (convDate >= today) {
      groups['Today'].push(conv);
    } else if (convDate >= yesterday) {
      groups['Yesterday'].push(conv);
    } else if (convDate >= sevenDaysAgo) {
      groups['Previous 7 Days'].push(conv);
    } else if (convDate >= thirtyDaysAgo) {
      groups['Previous 30 Days'].push(conv);
    } else {
      const monthName = convDate.toLocaleString(language, { month: 'long' });
      const year = convDate.getFullYear();
      const monthYearKey = `${monthName} ${year}`;
      if (!monthlyGroups[monthYearKey]) {
        monthlyGroups[monthYearKey] = [];
      }
      monthlyGroups[monthYearKey].push(conv);
    }
  }

  const result: GroupedConversations[] = [];

  if (groups['Today'].length > 0) {
    result.push({
      title: 'Today',
      conversations: groups['Today'],
    });
  }

  if (groups['Yesterday'].length > 0) {
    result.push({
      title: 'Yesterday',
      conversations: groups['Yesterday'],
    });
  }

  if (groups['Previous 7 Days'].length > 0) {
    result.push({
      title: 'Previous 7 Days',
      conversations: groups['Previous 7 Days'],
    });
  }

  if (groups['Previous 30 Days'].length > 0) {
    result.push({
      title: 'Previous 30 Days',
      conversations: groups['Previous 30 Days'],
    });
  }

  // Sort monthly groups by date (most recent month first)
  const sortedMonthKeys = Object.keys(monthlyGroups).sort((a, b) => {
    const dateA = new Date(a); // "Month Year" can be parsed by Date constructor
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

  for (const monthKey of sortedMonthKeys) {
    if (monthlyGroups[monthKey].length > 0) {
      result.push({ title: monthKey, conversations: monthlyGroups[monthKey] });
    }
  }

  return result;
}
