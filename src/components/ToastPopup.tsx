import { FC } from 'react';
import toast from 'react-hot-toast';
import { Button } from './Button';

/**
 * A toast popup component that displays confirmation messages with action buttons.
 *
 * @param t - The toast object from react-hot-toast for managing toast state
 * @param title - The main title/heading of the toast popup
 * @param description - The detailed description/message of the toast
 * @param note - Optional additional note or warning text
 * @param submitBtn - Text for the submit/action button
 * @param cancelBtn - Text for the cancel/dismiss button
 * @param onSubmit - Callback function to execute when submit button is clicked
 *
 * @remarks
 * This component is designed to be used with react-hot-toast to create interactive toast notifications.
 * It provides a dismissible popup with title, description, and optional note, along with submit and cancel buttons.
 *
 * @example
 * ```tsx
 * toast.custom((t) => (
 *   <ToastPopup
 *     t={t}
 *     title="Confirm Action"
 *     description="Are you sure you want to proceed?"
 *     note="This action cannot be undone."
 *     submitBtn="Confirm"
 *     cancelBtn="Cancel"
 *     onSubmit={handleSubmit}
 *   />
 * ));
 * ```
 */
export const ToastPopup: FC<{
  toastId: string;
  title: string;
  description: string;
  note?: string;
  submitBtn: string;
  cancelBtn: string;
  onSubmit: () => Promise<void> | void;
}> = ({
  toastId,
  title,
  description,
  note,
  submitBtn,
  cancelBtn,
  onSubmit,
}) => (
  <div className="flex flex-col gap-2">
    <p className="font-medium">{title}</p>
    <p className="text-sm">{description}</p>
    {note && (
      <p className="text-xs">
        <small>{note}</small>
      </p>
    )}
    <div className="flex justify-center gap-2 mt-1">
      <Button
        onClick={() => {
          toast.dismiss(toastId);
          onSubmit();
        }}
        variant="neutral"
        size="small"
      >
        {submitBtn}
      </Button>
      <Button
        onClick={() => toast.dismiss(toastId)}
        variant="ghost"
        size="small"
      >
        {cancelBtn}
      </Button>
    </div>
  </div>
);
