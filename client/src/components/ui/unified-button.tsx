import { forwardRef } from 'react';

interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const PrimaryButton = forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <button
        {...props}
        ref={ref}
        className={`inline-flex items-center justify-center rounded-full px-5 py-3 font-medium text-white bg-gradient-to-r from-rr-accent to-rr-accentDark hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rr-accent/40 transition-all ${className}`}
      >
        {children}
      </button>
    );
  }
);

export const SecondaryButton = forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <button
        {...props}
        ref={ref}
        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-all ${className}`}
      >
        {children}
      </button>
    );
  }
);

PrimaryButton.displayName = "PrimaryButton";
SecondaryButton.displayName = "SecondaryButton";