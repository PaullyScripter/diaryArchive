"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Image as ImageIcon } from "lucide-react";
import { useMediaGallery, useDeleteMedia, type MediaItem } from "@/hooks/use-media";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media-url";
import type { Editor } from "@tiptap/react";

interface MediaGalleryModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  /**
   * When provided, clicking a media item calls this instead of inserting into
   * the Tiptap `editor` (used to insert into the Monaco HTML/CSS editor).
   */
  onInsertItem?: (item: MediaItem) => void;
}

export function MediaGalleryModal({
  editor,
  isOpen,
  onClose,
  onInsertItem,
}: MediaGalleryModalProps) {
  const perPage = 12;
  const { data, isLoading, fetchNextPage, hasNextPage } = useMediaGallery(perPage);
  const deleteMedia = useDeleteMedia();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLButtonElement;
      setTimeout(() => dialogRef.current?.focus(), 0);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  const pages = data?.pages ?? [];
  const [pageIndex, setPageIndex] = useState(0);
  const currentPage = pages[pageIndex];
  const items: MediaItem[] = currentPage?.data ?? [];
  const totalItems = pages[0]?.meta?.total ?? 0;
  const totalPages = Math.max(pages.length, Math.ceil(totalItems / perPage));

  const goToPage = (idx: number) => {
    if (idx < 0 || idx >= totalPages) return;
    setPageIndex(idx);
  };

  const goNext = () => {
    if (pageIndex >= pages.length - 1 && hasNextPage) {
      fetchNextPage().then(() => setPageIndex(pageIndex + 1));
    } else {
      goToPage(pageIndex + 1);
    }
  };

  const handleInsert = (item: MediaItem) => {
    if (onInsertItem) {
      onInsertItem(item);
      onClose();
      return;
    }
    if (editor) {
      editor.chain().focus().setResizableImage({ src: resolveMediaUrl(item.url) ?? item.url }).run();
      onClose();
    }
  };

  const handleDelete = async (item: MediaItem) => {
    await deleteMedia.mutateAsync(item.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goToPage(pageIndex - 1);
  };

  if (!isOpen) return null;

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
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-background rounded-lg border border-border shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col mx-4 outline-none"
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
          {isLoading && pages.length === 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md bg-overlay/10 animate-pulse"
                />
              ))}
            </div>
          ) : totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No media uploaded yet.</p>
              <p className="text-xs mt-1">Upload images using the toolbar button.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className="group relative aspect-square rounded-md border border-border bg-overlay/5 overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                    onClick={() => handleInsert(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleInsert(item);
                      }
                    }}
                    aria-label={`Insert ${item.filename}`}
                  >
                    {item.mime_type.startsWith("image/") ? (
                      <img
                        src={resolveMediaUrl(item.thumbnail_url || item.url)}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-muted">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100">
                      <span className="px-2 py-1 text-xs bg-background text-foreground rounded shadow">
                        Insert
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                        className="p-1 rounded bg-background text-destructive shadow hover:bg-destructive hover:text-white transition-colors"
                        aria-label={`Delete ${item.filename}`}
                        tabIndex={-1}
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
                    onClick={() => goToPage(pageIndex - 1)}
                    disabled={pageIndex <= 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted">
                    {pageIndex + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goNext}
                    disabled={pageIndex >= totalPages - 1 && !hasNextPage}
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
