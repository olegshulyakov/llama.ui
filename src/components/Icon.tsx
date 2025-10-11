import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { IconBaseProps } from 'react-icons';
import * as LucideIcons from 'react-icons/lu';
import { cn } from '../utils';

type IconNames = keyof Omit<typeof LucideIcons, 'IconContext'>;

const iconVariants = cva('', {
  variants: {
    library: {
      lucide: 'lucide',
    },
    variant: {
      spin: 'animate-spin',
      current: 'fill-current',
      leftside: 'inline mr-1',
      rightside: 'inline ml-1',
    },
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      xl: 'h-8 w-8',
    },
  },
  defaultVariants: {
    library: 'lucide',
  },
});

type IconProps = Omit<IconBaseProps, 'size'> &
  VariantProps<typeof iconVariants> &
  React.SVGAttributes<SVGSVGElement> & {
    className?: string;
    icon: IconNames;
  };

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, library = 'lucide', variant, size, icon, ...props }, ref) => {
    let SelectedIcon: React.ElementType;

    switch (library) {
      case 'lucide':
        SelectedIcon = LucideIcons[icon];
        break;
      default:
        throw new Error(`Library "${library}" not found in icons`);
    }

    if (!SelectedIcon) {
      throw new Error(`Icon "${icon}" not found in Lucide icons`);
    }

    return (
      <SelectedIcon
        ref={ref}
        className={cn(iconVariants({ library, variant, size, className }))}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

export default Icon;
export { Icon };
