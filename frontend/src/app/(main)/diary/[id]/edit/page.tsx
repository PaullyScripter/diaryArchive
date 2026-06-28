"use client";

import { useParams } from "next/navigation";
import EditorPage from "@/components/editor/editor-page";

export default function EditDiaryPage() {
  const params = useParams();
  return <EditorPage diaryId={params.id as string} />;
}