import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', activeDark);
    setDark(activeDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  };

  return (
    <button 
      onClick={toggle} 
      className="rounded-full border border-stroke px-3 py-1 text-sm text-textDim hover:bg-card transition-colors duration-150"
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}