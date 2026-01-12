import { cn } from "@/lib/utils";

interface AvatarProps {
  size?: "small" | "medium" | "large";
  image?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Avatar({ size = "medium", image, children, className }: AvatarProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-10 h-10 text-sm",
    large: "w-12 h-12 text-base",
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold overflow-hidden flex-shrink-0",
        image ? "bg-neutral-200 dark:bg-neutral-700" : "bg-beta-navy text-white",
        sizeClasses[size],
        className
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="w-full h-full object-cover" />
      ) : (
        children
      )}
    </div>
  );
}

