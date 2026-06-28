import { cn } from "@/lib/utils";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
};

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    "bg-[#b8735a]",
    "bg-[#8a9ba8]",
    "bg-[#5a8f6a]",
    "bg-[#c49a4a]",
    "bg-[#6b5b95]",
    "bg-[#c44a4a]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, alt, size = "md", className }: AvatarProps) {
  const initials = getInitial(alt || "?");

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "rounded-full object-cover border border-border",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-primary-foreground font-medium border border-border select-none",
        sizeClasses[size],
        getColor(alt || "?"),
        className,
      )}
      aria-label={alt}
    >
      {initials}
    </div>
  );
}
