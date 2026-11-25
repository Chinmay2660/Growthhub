"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export default function QuestionTableSearch({
  value,
  onChange,
  className = "",
  inputId = "question-table-search",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputId?: string;
}) {
  return (
    <div className={className}>
      <label className="sr-only" htmlFor={inputId}>Search questions</label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <Input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by title or track…"
          className="!py-2 !pl-9 !pr-3"
        />
      </div>
    </div>
  );
}
