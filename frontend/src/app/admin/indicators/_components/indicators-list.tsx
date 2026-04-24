'use client';

import { useState }  from 'react';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import {
  Indicator,
  useCreateIndicator, useUpdateIndicator, useDeleteIndicator,
} from '@/lib/api/indicators';

interface Props {
  indicators:      Indicator[];
  isLoading:       boolean;
  canManage:       boolean;
  subjectName:     string;
  schoolYear:      number | string | undefined;
  subjectId:       string;
  schoolYearId:    string;
  grade:           number;
}

export function IndicatorsList({
  indicators, isLoading, canManage,
  subjectName, schoolYear,
  subjectId, schoolYearId, grade,
}: Props) {
  const [newText,    setNewText]    = useState('');
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editingText,setEditingText]= useState('');

  const createIndicator = useCreateIndicator();
  const updateIndicator = useUpdateIndicator();
  const deleteIndicator = useDeleteIndicator();

  function handleAdd() {
    if (!newText.trim()) return;
    createIndicator.mutate(
      { subjectId, schoolYearId, grade, description: newText.trim() },
      { onSuccess: () => setNewText('') },
    );
  }

  function handleEdit(indicator: Indicator) {
    setEditingId(indicator.id);
    setEditingText(indicator.description);
  }

  function handleSaveEdit() {
    if (!editingId || !editingText.trim()) return;
    updateIndicator.mutate(
      { id: editingId, description: editingText.trim() },
      { onSuccess: () => setEditingId(null) },
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Indicadores — {subjectName} {schoolYear && `(${schoolYear})`}
          </CardTitle>
          <Badge variant="secondary">{indicators.length} indicadores</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
        ) : indicators.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay indicadores cargados. Agregá el primero.
          </p>
        ) : (
          <div className="space-y-2">
            {indicators.map((indicator, index) => (
              <div
                key={indicator.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 group"
              >
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <GripVertical className="h-4 w-4 opacity-40" />
                  <span className="text-xs w-5 text-center">{index + 1}</span>
                </div>

                {editingId === indicator.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  handleSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-emerald-600"
                      onClick={handleSaveEdit}
                      disabled={updateIndicator.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm">{indicator.description}</p>
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleEdit(indicator)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteIndicator.mutate(indicator.id)}
                          disabled={deleteIndicator.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Descripción del indicador..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newText.trim() || createIndicator.isPending}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}