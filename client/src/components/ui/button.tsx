import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-lg font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
    
    const variants = {
      primary: "bg-brand-500 text-white hover:bg-brand-600",
      secondary: "border hover:bg-black/5 dark:hover:bg-white/5",
      ghost: "hover:bg-black/5 dark:hover:bg-white/5",
    };
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

// Export buttonVariants for compatibility with other components
export const buttonVariants = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "border hover:bg-black/5 dark:hover:bg-white/5", 
  ghost: "hover:bg-black/5 dark:hover:bg-white/5",
};