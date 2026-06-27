import { BookOpen, Users, UserPlus } from "lucide-react";

interface StatsDisplayProps {
  diaryCount: number;
  followerCount: number;
  followingCount: number;
  className?: string;
}

export function StatsDisplay({
  diaryCount,
  followerCount,
  followingCount,
  className,
}: StatsDisplayProps) {
  const stats = [
    { icon: BookOpen, label: "diaries", value: diaryCount },
    { icon: Users, label: "followers", value: followerCount },
    { icon: UserPlus, label: "following", value: followingCount },
  ];

  return (
    <div className={`flex items-center justify-center gap-6 ${className ?? ""}`}>
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-1.5 text-muted">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium text-foreground">{value}</span>
          <span className="text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}
