"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search diaries...",
  isLoading = false,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChange(localValue);
    }
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative" role="search">
      <label htmlFor="search-input" className="sr-only">
        Search diaries
      </label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
      <input
        ref={inputRef}
        id="search-input"
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 border border-border rounded-md bg-background text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Search diaries"
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle animate-spin" />
      ) : localValue ? (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-subtle hover:text-foreground"
          aria-label="Clear search"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}
