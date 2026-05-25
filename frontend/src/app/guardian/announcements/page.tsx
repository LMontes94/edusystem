'use client';

import { useAnnouncements } from '@/lib/api/announcements';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, BookOpen, Megaphone } from 'lucide-react';

export default function GuardianAnnouncementsPage() {
  const { data: announcements, isLoading, isError } = useAnnouncements();

  const published = announcements?.filter((a) => a.publishedAt) ?? [];
  const sorted = [...published].sort(
    (a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Comunicados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comunicados de la institución
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2 pt-4 px-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar los comunicados
        </p>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No hay comunicados publicados
        </div>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm">{a.title}</h3>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {a.scope === 'INSTITUTION' ? (
                          <><Globe className="h-3 w-3" /> Institución</>
                        ) : (
                          <><BookOpen className="h-3 w-3" /> {a.course?.name}</>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.author.firstName} {a.author.lastName} ·{' '}
                      {a.publishedAt
                        ? new Date(a.publishedAt).toLocaleDateString('es-AR')
                        : new Date(a.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <Badge variant="default" className="text-[10px] shrink-0">
                    Publicado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {a.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
