"use client";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface DateArchiveProps {
  selectedYear: number | null;
  selectedMonth: number | null;
  onSelectDate: (year: number | null, month: number | null) => void;
}

export function DateArchive({ selectedYear, selectedMonth, onSelectDate }: DateArchiveProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => onSelectDate(null, null)}
          className={`shrink-0 px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors ${
            selectedYear === null
              ? "bg-accent/10 border-accent text-accent"
              : "border-border text-muted hover:text-foreground hover:border-foreground/30"
          }`}
          type="button"
        >
          All Time
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onSelectDate(y, selectedYear === y ? selectedMonth : null)}
            className={`shrink-0 px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors ${
              selectedYear === y
                ? "bg-accent/10 border-accent text-accent"
                : "border-border text-muted hover:text-foreground hover:border-foreground/30"
            }`}
            type="button"
          >
            {y}
          </button>
        ))}
      </div>

      {selectedYear && (
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MONTHS.map((name, idx) => {
            const month = idx + 1;
            const isSelected = selectedMonth === month;
            return (
              <button
                key={name}
                onClick={() => onSelectDate(selectedYear, isSelected ? null : month)}
                className={`px-2 py-1 rounded text-xs cursor-pointer border transition-colors ${
                  isSelected
                    ? "bg-accent/10 border-accent text-accent"
                    : "border-border text-muted hover:text-foreground hover:border-foreground/30"
                }`}
                type="button"
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
