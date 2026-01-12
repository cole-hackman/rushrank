import { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface FeatureCardProps {
  title: string;
  description?: string;
  points: string[];
  icon: LucideIcon;
  iconColor?: string;
  ctaText?: string;
  onCtaClick?: () => void;
}

export function FeatureCard({ 
  title, 
  description, 
  points, 
  icon: Icon, 
  iconColor = "text-rr-accent",
  ctaText = "Learn more",
  onCtaClick 
}: FeatureCardProps) {
  return (
    <div className="rounded-2xl p-6 bg-rr-card border border-white/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group">
      <div className={`h-12 w-12 rounded-xl bg-white/10 ${iconColor} grid place-items-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-white/70 text-sm mb-4">{description}</p>
      )}
      <ul className="space-y-2 text-white/80 text-sm mb-6">
        {points.map((point, index) => (
          <li key={index} className="flex items-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-accent-500 mt-2 flex-shrink-0" />
            {point}
          </li>
        ))}
      </ul>
      {onCtaClick && (
        <Button 
          variant="secondary" 
          size="sm"
          onClick={onCtaClick}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 group-hover:bg-gradient-to-r group-hover:from-accent-500 group-hover:to-accent-600 group-hover:text-white transition-all"
        >
          {ctaText}
        </Button>
      )}
    </div>
  );
}