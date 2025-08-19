interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed py-14 text-center">
      <div className="max-w-sm space-y-2">
        <h4 className="font-semibold text-text">{title}</h4>
        <p className="text-sm text-text-muted">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}