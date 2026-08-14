"use client";

import {
  FileText,
  HeartHandshake,
  NotebookPen,
  PenLine,
  Plane,
} from "lucide-react";

import { DIARY_TEMPLATES, type DiaryTemplate } from "@/lib/editor/templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "file-text": FileText,
  "notebook-pen": NotebookPen,
  plane: Plane,
  "heart-handshake": HeartHandshake,
  "pen-line": PenLine,
};

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: DiaryTemplate) => void;
}

export function TemplatePicker({ isOpen, onClose, onApply }: TemplatePickerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            Whole-diary mode keeps everything in one document. A template lays
            out chapters to get you writing quickly — you can edit, rename, and
            reorder them afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {DIARY_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.icon] ?? FileText;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onApply(template)}
                className="text-left p-4 border border-border rounded-md bg-background hover:border-accent hover:bg-accent-soft transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md bg-accent-soft text-accent">
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {template.description}
                    </p>
                    {template.chapters.length > 0 && (
                      <p className="text-xs text-subtle mt-2 truncate">
                        {template.chapters.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
