import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const variants = cva('', {
  variants: {
    variant: {
      default: '',
      'group-title': 'block font-bold text-base-content text-start',
      'fake-btn': 'text-center cursor-pointer',
      btn: 'btn',
      'btn-ghost': 'btn btn-ghost',
      'form-control': 'form-control flex flex-col justify-center mb-3',
      'input-bordered':
        'input input-bordered join-item grow flex items-center gap-2 mb-1',
    },
    size: {
      default: '',
      xs: 'text-xs',
      icon: 'w-8 h-8 p-0',
      'icon-rounded': 'w-8 h-8 p-0 rounded-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> &
  VariantProps<typeof variants>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, size, ...props }, ref) => (
    <label
      className={cn(variants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
