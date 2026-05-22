'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers, type User } from '@/lib/api/users';
import { useAppSession } from '@/lib/hooks/use-app-session';

// ── Helpers ───────────────────────────

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function matches(user: User, q: string): boolean {
  const first = user.firstName.toLowerCase();
  const last = user.lastName.toLowerCase();
  const full = `${first} ${last}`;
  return first.includes(q) || last.includes(q) || full.includes(q);
}

// ── Props ─────────────────────────────

export interface UserSelectorProps {
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (userId: string) => void;
}

// ── Component ─────────────────────────

export function UserSelector({ selectedUsers, onSelect, onRemove }: UserSelectorProps) {
  const [query, setQuery] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: session } = useAppSession();
  const appUser = session?.user as { id?: string } | undefined;
  const currentUserId = appUser?.id;

  const { data: allUsers, isLoading, isError } = useUsers({});

  // ── Filtered results (memoized) ─────

  const available = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(
      (u) => u.id !== currentUserId && !selectedUsers.some((s) => s.id === u.id),
    );
  }, [allUsers, currentUserId, selectedUsers]);

  const normalizedQuery = normalize(query);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return [];
    return available.filter((u) => matches(u, normalizedQuery)).slice(0, 20);
  }, [available, normalizedQuery]);

  // ── Keyboard navigation ─────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    if (normalizedQuery.length === 0) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = highlightedIdx >= 0 ? highlightedIdx : 0;
      const user = filtered[idx];
      if (user) {
        onSelect(user);
        setQuery('');
        setHighlightedIdx(-1);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : -1));
      return;
    }

    if (e.key === 'Escape' && normalizedQuery.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setQuery('');
      setHighlightedIdx(-1);
      inputRef.current?.focus();
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightedIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx]);

  // ── Render ──────────────────────────

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Buscar usuarios..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 pl-8"
          autoFocus
        />
      </div>

      {/* Selected users — chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-full pl-1 pr-1.5 py-0.5 text-xs"
            >
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">
                  {initials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate">
                {user.firstName} {user.lastName}
              </span>
              <button
                type="button"
                onClick={() => onRemove(user.id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                tabIndex={-1}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results dropdown */}
      {normalizedQuery.length > 0 && (
        <div className="border rounded-md bg-popover text-popover-foreground shadow-sm">
          {isLoading && (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <p className="text-xs text-destructive text-center py-4">
              Error al cargar usuarios
            </p>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No se encontraron usuarios
            </p>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <div ref={listRef} className="max-h-48 overflow-y-auto py-1" role="listbox">
              {filtered.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={idx === highlightedIdx}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    idx === highlightedIdx
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => {
                    onSelect(user);
                    setQuery('');
                    setHighlightedIdx(-1);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {user.role.toLowerCase()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
