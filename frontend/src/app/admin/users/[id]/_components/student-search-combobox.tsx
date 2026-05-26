'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchStudents, StudentSearchResult } from '@/lib/api/guardians';

interface Props {
  onSelect: (student: StudentSearchResult) => void;
  excludeIds: string[];
  disabled?: boolean;
}

export function StudentSearchCombobox({ onSelect, excludeIds, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useSearchStudents(debounced);

  const filtered = (results ?? []).filter((s) => !excludeIds.includes(s.id));

  function handleSelect(student: StudentSearchResult) {
    setSelectedLabel(`${student.firstName} ${student.lastName}`);
    setQuery('');
    setOpen(false);
    onSelect(student);
  }

  function handleFocus() {
    if (debounced.length >= 2) setOpen(true);
  }

  return (
    <div className="relative flex gap-2">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          placeholder="Buscar alumno..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) setOpen(true);
            else setOpen(false);
            setSelectedLabel('');
          }}
          onFocus={handleFocus}
          disabled={disabled}
          className="h-8 text-sm"
        />
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 max-h-48 overflow-y-auto">
            {isFetching ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              filtered.map((s) => {
                const course = s.courseStudents?.[0]?.course;
                const label = course
                  ? `${s.firstName} ${s.lastName} — ${course.name}`
                  : `${s.firstName} ${s.lastName}`;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => handleSelect(s)}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      <Button
        size="sm"
        className="h-8"
        disabled={!selectedLabel || disabled}
        onClick={() => {
          if (selectedLabel) {
            const selected = (results ?? []).find(
              (s) => `${s.firstName} ${s.lastName}` === selectedLabel,
            );
            if (selected) handleSelect(selected);
          }
        }}
      >
        Vincular
      </Button>
    </div>
  );
}
