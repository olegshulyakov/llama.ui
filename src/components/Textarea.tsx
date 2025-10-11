import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const variants = cva('textarea min-h-auto resize-none', {
  variants: {
    variant: {
      default: 'focus:outline-1 focus:outline-offset-0',
      code: 'font-mono',
      transparent:
        'bg-transparent border-none outline-none ring-0 focus:outline-none focus:ring-0',
    },
    size: {
      default: 'h-24',
      full: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof variants>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, ...props }, ref) => (
    <textarea
      className={cn(variants({ variant, size, className }))}
      ref={ref}
      dir="auto"
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
