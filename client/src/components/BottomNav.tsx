import { Home, Users, Calendar, BarChart3, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export function BottomNav() {
  const [location] = useLocation();

  const Item = ({ href, icon, label, active = false }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
  }) => (
    <Link href={href}>
      <button className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors duration-150 ${
        active ? 'text-pop' : 'text-textDim hover:text-text'
      }`}>
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </button>
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stroke bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-md justify-between">
        <Item 
          href="/" 
          icon={<Home className="h-5 w-5" />} 
          label="Home" 
          active={location === '/'} 
        />
        <Item 
          href="/dashboard" 
          icon={<Users className="h-5 w-5" />} 
          label="PNMs" 
          active={location === '/dashboard'} 
        />
        <Item 
          href="/events" 
          icon={<Calendar className="h-5 w-5" />} 
          label="Events" 
          active={location === '/events'} 
        />
        <Item 
          href="/results" 
          icon={<BarChart3 className="h-5 w-5" />} 
          label="Results" 
          active={location === '/results'} 
        />
        <Item 
          href="/voting" 
          icon={<MoreHorizontal className="h-5 w-5" />} 
          label="More" 
          active={location === '/voting'} 
        />
      </div>
    </nav>
  );
}