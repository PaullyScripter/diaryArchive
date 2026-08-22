"use client";

import dynamic from "next/dynamic";

const EditorPage = dynamic(() => import("@/components/editor/editor-page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-6 w-32 bg-muted animate-pulse" />
    </div>
  ),
});

export default function NewDiaryPage() {
  return <EditorPage />;
}