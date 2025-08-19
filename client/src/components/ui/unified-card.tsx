import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
}

interface CardBodyProps {
  children: ReactNode;
}

export function UnifiedCard({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl bg-rr-surface/95 border border-rr-border shadow-rrGlow ${className}`}>
      {children}
    </div>
  );
}

export function UnifiedCardHeader({ title, subtitle }: CardHeaderProps) {
  return (
    <div className="p-6 border-b border-rr-border">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-rr-muted mt-1">{subtitle}</p>}
    </div>
  );
}

export function UnifiedCardBody({ children }: CardBodyProps) {
  return (
    <div className="p-6">{children}</div>
  );
}