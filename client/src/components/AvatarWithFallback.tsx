import { useState } from 'react';

interface AvatarWithFallbackProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-lg',
};

export function AvatarWithFallback({ src, name, size = 'md', className = '' }: AvatarWithFallbackProps) {
  const [imageError, setImageError] = useState(false);
  
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradientColors = (fullName: string) => {
    const colors = [
      ['from-blue-400', 'to-blue-600'],
      ['from-purple-400', 'to-purple-600'],
      ['from-green-400', 'to-green-600'],
      ['from-yellow-400', 'to-yellow-600'],
      ['from-pink-400', 'to-pink-600'],
      ['from-indigo-400', 'to-indigo-600'],
      ['from-red-400', 'to-red-600'],
      ['from-teal-400', 'to-teal-600'],
    ];
    
    const index = fullName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const shouldShowImage = src && !imageError;
  const gradientColors = getGradientColors(name);

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      {shouldShowImage ? (
        <img
          src={src.startsWith('/objects/') ? src : `/objects/${src}`}
          alt={`${name} profile`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`
          w-full h-full flex items-center justify-center text-white font-bold
          bg-gradient-to-br ${gradientColors[0]} ${gradientColors[1]}
          avatar-fallback
        `}>
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}