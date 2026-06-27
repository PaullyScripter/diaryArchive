"use client";

import { ProtectedRoute } from "@/components/shared/protected-route";
import { DiaryForm } from "@/components/diary/diary-form";
import { useCreateDiary } from "@/hooks/use-diaries";

function CreateDiaryContent() {
  const createDiary = useCreateDiary();

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="font-serif text-xl font-semibold text-foreground mb-1">
          New Diary
        </h1>
        <p className="text-xs text-muted mb-6">
          Rich text editing coming in a future update. Plain text for now.
        </p>
      </div>
      <DiaryForm
        onSubmit={async (data) => {
          const result = await createDiary.mutateAsync(data);
          return result as { id: string };
        }}
        isSubmitting={createDiary.isPending}
      />
    </div>
  );
}

export default function NewDiaryPage() {
  return (
    <ProtectedRoute>
      <CreateDiaryContent />
    </ProtectedRoute>
  );
}
