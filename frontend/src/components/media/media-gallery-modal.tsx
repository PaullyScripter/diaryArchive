"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Image as ImageIcon } from "lucide-react";
import { useMediaGallery, useDeleteMedia, type MediaItem } from "@/hooks/use-media";
import { Button } from "@/components/ui/button";
import type { Editor } from "@tiptap/react";

interface MediaGalleryModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaGalleryModal({ editor, isOpen, onClose }: MediaGalleryModalProps) {
  const [page, setPage] = useState(1);
  const perPage = 12;
  const { data, isLoading, fetchNextPage, hasNextPage } = useMediaGallery(perPage);
  const deleteMedia = useDeleteMedia();

  if (!isOpen) return null;

  const allItems: MediaItem[] =
    data?.pages?.flatMap((p) => p.data || []) ?? [];

  const startIdx = (page - 1) * perPage;
  const visibleItems = allItems.slice(startIdx, startIdx + perPage);
  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / perPage);

  const handleInsert = (item: MediaItem) => {
    if (editor) {
      editor.chain().focus().setResizableImage({ src: item.url }).run();
      onClose();
    }
  };

  const handleDelete = async (item: MediaItem) => {
    await deleteMedia.mutateAsync(item.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative bg-background rounded-lg border border-border shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        role="dialog"
        aria-modal="true"
        aria-label="Media gallery"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Media Gallery</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-overlay"
            aria-label="Close gallery"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && !allItems.length ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md bg-overlay/10 animate-pulse"
                />
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No media uploaded yet.</p>
              <p className="text-xs mt-1">Upload images using the toolbar button.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square rounded-md border border-border bg-overlay/5 overflow-hidden"
                  >
                    {item.mime_type.startsWith("image/") ? (
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-muted">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleInsert(item)}
                        className="px-2 py-1 text-xs bg-background text-foreground rounded shadow hover:bg-accent hover:text-white transition-colors"
                        aria-label={`Insert ${item.filename}`}
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="p-1 rounded bg-background text-destructive shadow hover:bg-destructive hover:text-white transition-colors"
                        aria-label={`Delete ${item.filename}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (page >= totalPages && hasNextPage) {
                        fetchNextPage();
                      }
                      setPage(page + 1);
                    }}
                    disabled={page >= totalPages && !hasNextPage}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
