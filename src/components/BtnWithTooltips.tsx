import { Button } from './Button';

/**
 * @deprecated Use `title` and `aria-label` props in button directly as utiliy classes.
 *
 * Wraps any button that needs a tooltip message.
 *
 * @param className - Optional additional classes to apply to the button
 * @param onClick - Optional click handler for the container element
 * @param onMouseLeave - Optional mouse leave handler for the inner button
 * @param children - React node to render inside the button
 * @param tooltipsContent - Text content to show in tooltip
 * @param disabled - Whether the button should be disabled
 */
export function BtnWithTooltips({
  className,
  onClick,
  onMouseLeave,
  children,
  tooltipsContent,
  disabled,
}: {
  className?: string;
  onClick?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  tooltipsContent: string;
  disabled?: boolean;
}) {
  // the onClick handler is on the container, so screen readers can safely ignore the inner button
  // this prevents the label from being read twice
  return (
    <div
      className="tooltip tooltip-bottom"
      data-tip={tooltipsContent}
      role="button"
      onClick={onClick}
    >
      <Button
        className={`${className ?? ''} flex items-center justify-center`}
        disabled={disabled}
        onMouseLeave={onMouseLeave}
        aria-hidden={true}
      >
        {children}
      </Button>
    </div>
  );
}
