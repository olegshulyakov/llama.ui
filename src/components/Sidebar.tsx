import {
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { useChatContext } from '../context/chat';
import StorageUtils from '../database';
import { Conversation } from '../types';
import { classNames } from '../utils';
import { useModals } from './ModalProvider';

export default function Sidebar() {
  const navigate = useNavigate();
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
    () => groupConversationsByDate(conversations),
    [conversations]
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
              aria-label="Close sidebar"
              role="button"
              tabIndex={0}
            >
              <XMarkIcon className="w-5 h-5" />
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
              aria-label="New conversation"
            >
              <PencilSquareIcon className="w-5 h-5" />
            </button>
          </div>

          {/* scrollable conversation list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {groupedConv.map((group, i) => (
              <div key={i} role="group">
                {/* group name (by date) */}
                {group.title ? (
                  // we use btn class here to make sure that the padding/margin are aligned with the other items
                  <b
                    className="btn btn-ghost btn-xs bg-none btn-disabled block text-xs text-base-content text-start px-2 mb-0 mt-6 font-bold opacity-75"
                    role="note"
                    aria-description={group.title}
                    tabIndex={0}
                  >
                    {group.title}
                  </b>
                ) : (
                  <div className="h-2" />
                )}

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
                        toast.error(
                          'Cannot delete conversation while generating'
                        );
                        return;
                      }
                      if (
                        await showConfirm(
                          'Are you sure to delete this conversation?'
                        )
                      ) {
                        toast.success('Conversation deleted');
                        StorageUtils.deleteConversation(conv.id);
                        navigate('/');
                      }
                    }}
                    onDownload={async () => {
                      if (isGenerating(conv.id)) {
                        toast.error(
                          'Cannot download conversation while generating'
                        );
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
                        toast.error(
                          'Cannot rename conversation while generating'
                        );
                        return;
                      }
                      const newName = await showPrompt(
                        'Enter new name for the conversation',
                        conv.name
                      );
                      if (newName && newName.trim().length > 0) {
                        StorageUtils.updateConversationName(conv.id, newName);
                      }
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Footer always at the bottom */}
          <div className="text-center text-xs opacity-75 mx-4 pt-4">
            Conversations are saved to browser's IndexedDB
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
}: {
  conv: Conversation;
  isCurrConv: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onRename: () => void;
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
        title={conv.name}
        dir="auto"
        type="button"
        aria-label={`Select conversation: ${conv.name}`}
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
          title="More"
          aria-label="Show more options"
        >
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
        {/* dropdown menu */}
        <ul
          aria-label="More options"
          role="menu"
          tabIndex={-1}
          className="dropdown-content menu bg-base-100 rounded-box z-[1] p-2 shadow"
        >
          <li role="menuitem" tabIndex={0} onClick={onRename}>
            <button type="button" aria-label="Rename conversation">
              <PencilIcon className="w-4 h-4" />
              Rename
            </button>
          </li>
          <li role="menuitem" tabIndex={0} onClick={onDownload}>
            <button type="button" aria-label="Download conversation">
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download
            </button>
          </li>
          <li
            role="menuitem"
            tabIndex={0}
            className="text-error"
            onClick={onDelete}
          >
            <button type="button" aria-label="Delete conversation">
              <TrashIcon className="w-4 h-4" />
              Delete
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
  conversations: Conversation[]
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
      const monthName = convDate.toLocaleString('default', { month: 'long' });
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
      title: undefined, // no title for Today
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
