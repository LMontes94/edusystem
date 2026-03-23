'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  usePublishAnnouncement,
  useDeleteAnnouncement,
  Announcement,
} from '@/lib/api/announcements';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Send, Trash2, Globe, BookOpen, Pencil } from 'lucide-react';

const createSchema = z.object({
  title:    z.string().min(1, 'Requerido').max(200),
  content:  z.string().min(1, 'Requerido'),
  scope:    z.enum(['INSTITUTION', 'COURSE']),
  courseId: z.string().optional(),
}).refine(
  (data) => data.scope === 'INSTITUTION' || !!data.courseId,
  { message: 'Seleccioná un curso', path: ['courseId'] },
);

type CreateForm = z.infer<typeof createSchema>;

export default function AnnouncementsPage() {
  const [dialogOpen,          setDialogOpen]          = useState(false);
  const [filter,              setFilter]              = useState<'all' | 'published' | 'draft'>('all');
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const { data: announcements, isLoading } = useAnnouncements();
  const { data: courses }                  = useCourses();
  const createAnnouncement                 = useCreateAnnouncement();
  const updateAnnouncement                 = useUpdateAnnouncement();
  const publishAnnouncement                = usePublishAnnouncement();
  const deleteAnnouncement                 = useDeleteAnnouncement();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title:    '',
      content:  '',
      scope:    'INSTITUTION',
      courseId: '',
    },
  });

  const watchScope = form.watch('scope');

  function handleEdit(announcement: Announcement) {
    setEditingAnnouncement(announcement);
    form.reset({
      title:    announcement.title,
      content:  announcement.content,
      scope:    announcement.scope,
      courseId: announcement.course?.id ?? '',
    });
    setDialogOpen(true);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingAnnouncement(null);
      form.reset({ title: '', content: '', scope: 'INSTITUTION', courseId: '' });
    }
  }

  async function onSubmit(data: CreateForm) {
    const payload = {
      ...data,
      courseId: data.scope === 'COURSE' ? data.courseId : undefined,
    };

    if (editingAnnouncement) {
      await updateAnnouncement.mutateAsync({ id: editingAnnouncement.id, data: payload });
      setEditingAnnouncement(null);
    } else {
      await createAnnouncement.mutateAsync(payload);
    }

    setDialogOpen(false);
    form.reset();
  }

  const filtered = announcements?.filter((a) => {
    if (filter === 'published') return !!a.publishedAt;
    if (filter === 'draft')     return !a.publishedAt;
    return true;
  });

  const isSaving = createAnnouncement.isPending || updateAnnouncement.isPending;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Comunicados</h1>
          <p className="text-sm text-muted-foreground">
            {announcements?.length ?? 0} comunicados
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo comunicado
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? 'Editar comunicado' : 'Nuevo comunicado'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Reunión de padres — 15 de abril" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenido</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        placeholder="Escribí el contenido del comunicado..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinatarios</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INSTITUTION">Toda la institución</SelectItem>
                        <SelectItem value="COURSE">Un curso específico</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchScope === 'COURSE' && (
                <FormField control={form.control} name="courseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná un curso..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courses?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!editingAnnouncement && (
                <p className="text-xs text-muted-foreground">
                  El comunicado se guarda como borrador. Publicalo cuando esté listo.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : editingAnnouncement ? 'Guardar cambios' : 'Guardar borrador'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Borradores'}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered?.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No hay comunicados
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm">{announcement.title}</h3>
                      {announcement.publishedAt ? (
                        <Badge variant="default" className="text-xs">Publicado</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Borrador</Badge>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {announcement.scope === 'INSTITUTION' ? (
                          <><Globe className="h-3 w-3" /> Institución</>
                        ) : (
                          <><BookOpen className="h-3 w-3" /> {announcement.course?.name}</>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {announcement.author.firstName} {announcement.author.lastName} ·{' '}
                      {announcement.publishedAt
                        ? `Publicado ${format(new Date(announcement.publishedAt), "d 'de' MMMM", { locale: es })}`
                        : `Creado ${format(new Date(announcement.createdAt), "d 'de' MMMM", { locale: es })}`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!announcement.publishedAt && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleEdit(announcement)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishAnnouncement.mutate(announcement.id)}
                          disabled={publishAnnouncement.isPending}
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Publicar
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAnnouncement.mutate(announcement.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {announcement.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}