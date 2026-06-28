import { LockIcon } from "@/components/shared/icons";

export function PrivacyBadge({ privacy }: { privacy: string }) {
  if (privacy === "private") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-muted/20 text-subtle">
        <LockIcon className="w-3 h-3" />
        Private
      </span>
    );
  }
  if (privacy === "draft") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-muted/20 text-subtle">
        Draft
      </span>
    );
  }
  return null;
}
