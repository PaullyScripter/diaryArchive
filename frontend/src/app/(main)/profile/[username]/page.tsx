"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Users, UserPlus } from "lucide-react";

import { useUserDiaries, useUserProfile } from "@/hooks/use-user";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/shared/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FollowButton } from "@/components/social/follow-button";
import { relativeTime } from "@/lib/utils";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { data: profile, isLoading, error } = useUserProfile(username);
  const [page, setPage] = useState(1);
  const { data: diaries } = useUserDiaries(username, page);
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.username === username;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h1 className="font-serif text-xl font-semibold text-foreground mb-2">
          User not found
        </h1>
        <p className="text-sm text-muted mb-4">
          This user does not exist or their account has been suspended.
        </p>
        <Link href="/" className="text-sm text-link hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex flex-col items-center text-center mb-8">
        <Avatar
          src={profile.avatar_path}
          alt={profile.username}
          size="xl"
          className="mb-4"
        />
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {profile.username}
        </h1>

        {profile.about && (
          <p className="text-sm text-muted mt-2 max-w-md">{profile.about}</p>
        )}

        {profile.currently_feeling && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
            feeling {profile.currently_feeling}
          </span>
        )}

        <div className="flex items-center justify-center gap-5 mt-4 text-muted">
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium text-foreground">
              {profile.stats.diary_count}
            </span>
            <span className="text-xs">diaries</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium text-foreground">
              {profile.stats.follower_count}
            </span>
            <span className="text-xs">followers</span>
          </div>
          <div className="flex items-center gap-1">
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-medium text-foreground">
              {profile.stats.following_count}
            </span>
            <span className="text-xs">following</span>
          </div>
        </div>

        <div className="mt-4">
          {isOwnProfile ? (
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                Edit Profile
              </Button>
            </Link>
          ) : (
            <FollowButton
              username={profile.username}
              initialIsFollowing={profile.is_following}
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="diaries">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="diaries">Diaries</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="followers">Followers</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>

        <TabsContent value="diaries">
          {diaries && diaries.entries.length > 0 ? (
            <div className="space-y-0">
              {diaries.entries.map((entry) => (
                <article
                  key={entry.id}
                  className="py-3 border-b border-border last:border-b-0"
                >
                  <Link
                    href={`/diary/${entry.id}`}
                    className="text-lg font-serif font-semibold text-foreground leading-snug no-underline hover:underline"
                  >
                    {entry.title ?? "Untitled"}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">
                    <span>{relativeTime(entry.created_at)}</span>
                    {entry.emotion && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="text-accent">{entry.emotion}</span>
                      </>
                    )}
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="mt-1 text-xs">
                      {entry.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/explore?tag=${tag}`}
                          className="text-link hover:underline mr-1"
                        >
                          #{tag}
                        </Link>
                      ))}
                    </div>
                  )}
                  {entry.excerpt && (
                    <p className="mt-1 text-xs text-muted leading-snug line-clamp-2">
                      {entry.excerpt}
                    </p>
                  )}
                </article>
              ))}
              {diaries.meta.has_next && (
                <div className="pt-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted">
                {isOwnProfile
                  ? "No diaries yet. The blank page is waiting."
                  : "This user hasn't published any diaries yet."}
              </p>
              {isOwnProfile && (
                <Link href="/diary/new" className="inline-block mt-3">
                  <Button variant="primary" size="sm">
                    Write your first diary
                  </Button>
                </Link>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  About
                </h3>
                <p className="text-sm text-foreground">
                  {profile.about ?? "No bio yet."}
                </p>
              </div>
              {profile.favorite_quote && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                    Favorite Quote
                  </h3>
                  <p className="text-sm text-foreground italic">
                    &ldquo;{profile.favorite_quote}&rdquo;
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                  Joined
                </h3>
                <p className="text-sm text-foreground">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followers">
          <div className="text-center py-12 text-sm text-muted">
            Followers will be displayed here in a future update.
          </div>
        </TabsContent>

        <TabsContent value="following">
          <div className="text-center py-12 text-sm text-muted">
            Following will be displayed here in a future update.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex flex-col items-center text-center mb-8">
        <Skeleton className="w-24 h-24 rounded-full mb-4" />
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-2" />
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex gap-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
