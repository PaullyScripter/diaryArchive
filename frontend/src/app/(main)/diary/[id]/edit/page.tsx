"use client";

import { useParams, useRouter } from "next/navigation";

import { ProtectedRoute } from "@/components/shared/protected-route";
import { DiaryForm } from "@/components/diary/diary-form";
import { useDiary, useUpdateDiary } from "@/hooks/use-diaries";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";

function EditDiaryContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: diary, isLoading } = useDiary(id);
  const updateDiary = useUpdateDiary();
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!diary || (user && diary.author.id !== user.id)) {
    router.push(`/diary/${id}`);
    return null;
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="font-serif text-xl font-semibold text-foreground mb-1">
          Edit Diary
        </h1>
      </div>
      <DiaryForm
        initialData={{
          title: diary.title ?? "",
          content_text: diary.content_text ?? "",
          tags: diary.tags,
          emotion: diary.emotion,
          privacy: diary.privacy,
          comments_enabled: diary.comments_enabled,
          content_warnings: diary.content_warnings,
        }}
        onSubmit={async (data) => {
          await updateDiary.mutateAsync({ id, ...data });
          return { id };
        }}
        submitLabel="Save Changes"
        isSubmitting={updateDiary.isPending}
      />
    </div>
  );
}

export default function EditDiaryPage() {
  return (
    <ProtectedRoute>
      <EditDiaryContent />
    </ProtectedRoute>
  );
}
