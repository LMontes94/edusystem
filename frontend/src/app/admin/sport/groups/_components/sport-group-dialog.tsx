'use client';

import { useEffect, useState } from 'react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Badge }    from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                   from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                   from '@/components/ui/select';
import { XIcon, PlusIcon } from 'lucide-react';
import {
  useSports, useSportGroups,
  useCreateSportGroup, useUpdateSportGroup,
  SportGroup,
}                   from '@/lib/api/sports';
import { useUsers }       from '@/lib/api/users';
import { useSchoolYears } from '@/lib/api/courses';

interface Props {
  group?:       SportGroup;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function SportGroupDialog({ group, open, onOpenChange }: Props) {
  const isEdit = !!group;

  const [name,         setName]         = useState('');
  const [sportId,      setSportId]      = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [teacherIds,   setTeacherIds]   = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const { data: sports }      = useSports();
  const { data: schoolYears } = useSchoolYears();
  const { data: teachers }    = useUsers({ role: 'TEACHER' });

  const createGroup = useCreateSportGroup();
  const updateGroup = useUpdateSportGroup();
  const isPending   = createGroup.isPending || updateGroup.isPending;

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '');
      setSportId(group?.sportId ?? '');
      setSchoolYearId(group?.schoolYearId ?? '');
      setTeacherIds(group?.teachers.map(t => t.userId) ?? []);
      setSelectedTeacher('');
    }
  }, [open, group]);

  function addTeacher() {
    if (selectedTeacher && !teacherIds.includes(selectedTeacher)) {
      setTeacherIds(prev => [...prev, selectedTeacher]);
      setSelectedTeacher('');
    }
  }

  function removeTeacher(id: string) {
    setTeacherIds(prev => prev.filter(t => t !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      await updateGroup.mutateAsync({
        id: group.id,
        data: { name: name.trim(), teacherIds },
      });
    } else {
      await createGroup.mutateAsync({
        name: name.trim(), sportId, schoolYearId, teacherIds,
      });
    }
    onOpenChange(false);
  }

  const availableTeachers = teachers?.filter(t => !teacherIds.includes(t.id)) ?? [];
  const selectedTeacherObjs = teachers?.filter(t => teacherIds.includes(t.id)) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar grupo' : 'Nuevo grupo de deporte'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Deporte — solo al crear */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Deporte *</Label>
              <Select value={sportId} onValueChange={setSportId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un deporte" />
                </SelectTrigger>
                <SelectContent modal={false}>
                  {sports?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Año lectivo — solo al crear */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Año lectivo *</Label>
              <Select value={schoolYearId} onValueChange={setSchoolYearId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el año lectivo" />
                </SelectTrigger>
                <SelectContent modal={false}>
                  {schoolYears?.map((sy: any) => (
                    <SelectItem key={sy.id} value={sy.id}>{sy.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del grupo *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Fútbol A, Vóley 1°/2°..."
              required
            />
          </div>

          {/* Docentes */}
          <div className="space-y-2">
            <Label>Docentes *</Label>
            <div className="flex gap-2">
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Agregar docente" />
                </SelectTrigger>
                <SelectContent modal={false}>
                  {availableTeachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={addTeacher}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            {selectedTeacherObjs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {selectedTeacherObjs.map(t => (
                  <Badge key={t.id} variant="secondary" className="gap-1">
                    {t.firstName} {t.lastName}
                    <button type="button" onClick={() => removeTeacher(t.id)}>
                      <XIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || teacherIds.length === 0}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear grupo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateSportGroupButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        Nuevo grupo
      </Button>
      <SportGroupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}