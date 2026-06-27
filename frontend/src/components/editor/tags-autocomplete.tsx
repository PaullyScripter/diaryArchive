"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagsAutocompleteProps {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

interface TagSuggestion {
  name: string;
  count: number;
}

export function TagsAutocomplete({ value, onChange, max = 50 }: TagsAutocompleteProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const { apiClient } = await import("@/lib/api/client");
        const res = await apiClient.get("/tags/search", { params: { q, limit: 10 } });
        setSuggestions(res.data.data ?? []);
        setShowSuggestions(true);
        setHighlightIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const addTag = (tag: string) => {
    const cleaned = tag.toLowerCase().trim().replace(/\s+/g, "-");
    if (!cleaned || value.includes(cleaned) || value.length >= max) return;
    onChange([...value, cleaned]);
    setInput("");
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, suggestions.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
          addTag(suggestions[highlightIdx].name);
        } else if (input.trim()) {
          addTag(input);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    } else if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-tag-bg text-muted"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-subtle hover:text-foreground cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => input.trim() && setShowSuggestions(true)}
        placeholder="Type to search or create tags..."
        disabled={value.length >= max}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-background shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => addTag(s.name)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer ${
                i === highlightIdx ? "bg-overlay text-foreground" : "text-muted"
              }`}
            >
              <span>{s.name}</span>
              <span className="text-subtle">{s.count}</span>
            </button>
          ))}
          {input.trim() && !suggestions.some((s) => s.name === input.toLowerCase().trim()) && (
            <button
              type="button"
              onClick={() => addTag(input)}
              onMouseEnter={() => setHighlightIdx(suggestions.length)}
              className={`w-full flex items-center px-3 py-1.5 text-xs cursor-pointer ${
                highlightIdx === suggestions.length ? "bg-overlay text-foreground" : "text-muted"
              }`}
            >
              Create &ldquo;{input.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-subtle mt-1">{value.length}/{max} tags</p>
    </div>
  );
}