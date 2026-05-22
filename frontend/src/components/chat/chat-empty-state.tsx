'use client';

import { MessageCircle } from 'lucide-react';

interface ChatEmptyStateProps {
  title: string;
  description?: string;
}

export function ChatEmptyState({ title, description }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs mt-1">{description}</p>
      )}
    </div>
  );
}
