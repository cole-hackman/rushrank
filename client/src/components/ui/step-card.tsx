interface StepCardProps {
  step: number;
  title: string;
  description: string;
  className?: string;
}

export function StepCard({ step, title, description, className = "" }: StepCardProps) {
  return (
    <li className={`rounded-2xl p-6 bg-rr-card border border-white/10 hover:bg-white/10 transition-all group ${className}`}>
      <div className="text-xs uppercase tracking-wide text-accent-500 font-semibold mb-2 group-hover:text-accent-600 transition-colors">
        Step {step}
      </div>
      <div className="text-xl font-semibold text-white mb-2 group-hover:text-white/90 transition-colors">
        {title}
      </div>
      <p className="text-white/70 text-sm">
        {description}
      </p>
    </li>
  );
}