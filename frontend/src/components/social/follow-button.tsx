"use client";

import { useState } from "react";
import { useToggleFollow } from "@/hooks/use-social";
import { Button } from "@/components/ui/button";

interface FollowButtonProps {
  username: string;
  initialIsFollowing: boolean;
  size?: "sm" | "default";
}

export function FollowButton({ username, initialIsFollowing, size = "default" }: FollowButtonProps) {
  const [optimisticFollowing, setOptimisticFollowing] = useState(initialIsFollowing);
  const [isHovering, setIsHovering] = useState(false);
  const toggleFollow = useToggleFollow(username);

  const isFollowing = optimisticFollowing;

  const handleToggle = () => {
    const prev = isFollowing;
    setOptimisticFollowing(!prev);

    toggleFollow.mutate(undefined, {
      onError: () => {
        setOptimisticFollowing(prev);
      },
    });
  };

  const label = isFollowing ? (isHovering ? "Unfollow" : "Following") : "Follow";

  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size={size}
      onClick={handleToggle}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      disabled={toggleFollow.isPending}
      aria-pressed={isFollowing}
      className={
        isFollowing && isHovering ? "text-destructive border-destructive/30" : ""
      }
    >
      {label}
    </Button>
  );
}
