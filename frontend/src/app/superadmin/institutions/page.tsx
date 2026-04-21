'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAllInstitutions, useUpdatePlan } from '@/lib/api/institution';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Badge }  from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, MoreHorizontal, Settings, TrendingUp,
  Users, GraduationCap, BookOpen,
} from 'lucide-react';

// ── Schema crear institución ──────────────────
const createSchema = z.object({
  name:           z.string().min(1, 'Requerido'),
  domain:         z.string().optional(),
  address:        z.string().optional(),
  phone:          z.string().optional(),
  adminEmail:     z.string().email('Email inválido'),
  adminPassword:  z.string().min(8, 'Mínimo 8 caracteres'),
  adminFirstName: z.string().min(1, 'Requerido'),
  adminLastName:  z.string().min(1, 'Requerido'),
});
type CreateForm = z.infer<typeof createSchema>;

const planConfig: Record<string, { label: string; color: string }> = {
  FREE:       { label: 'Gratuito',   color: 'bg-gray-100 text-gray-600'     },
  STARTER:    { label: 'Starter',    color: 'bg-blue-100 text-blue-700'     },
  PRO:        { label: 'Pro',        color: 'bg-purple-100 text-purple-700' },
  ENTERPRISE: { label: 'Enterprise', color: 'bg-amber-100 text-amber-700'   },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE:    { label: 'Activa',      variant: 'default'     },
  TRIAL:     { label: 'Trial',       variant: 'secondary'   },
  SUSPENDED: { label: 'Suspendida',  variant: 'destructive' },
};

// ── Hook crear institución ────────────────────
function useCreateInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateForm) => {
      const res = await api.post('/institutions', data);
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['institutions', 'all'] });
      toast.success(`Institución "${result.institution.name}" creada — Admin: ${result.admin.email}`);
    },
    onError: () => toast.error('Error al crear la institución'),
  });
}

// ── Dialog plan/status ────────────────────────
function PlanDialog({
  institution, onClose,
}: {
  institution: any;
  onClose: () => void;
}) {
  const [plan,   setPlan]   = useState(institution.plan);
  const [status, setStatus] = useState(institution.status);
  const updatePlan = useUpdatePlan();

  async function handleSave() {
    await updatePlan.mutateAsync({ id: institution.id, data: { plan, status } });
    onClose();
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Plan</label>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">Gratuito</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Estado</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Activa</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Suspendida</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={updatePlan.isPending}>
          {updatePlan.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────
export default function SuperAdminInstitutionsPage() {
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan,   setFilterPlan]   = useState('all');
  const [createDialog, setCreateDialog] = useState(false);
  const [planDialog,   setPlanDialog]   = useState<any | null>(null);

  const { data: institutions, isLoading } = useAllInstitutions();
  const createInstitution = useCreateInstitution();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '', name: '' },
  });

  async function onSubmit(data: CreateForm) {
    await createInstitution.mutateAsync(data);
    setCreateDialog(false);
    form.reset();
  }

  const filtered = institutions?.filter((inst) => {
    const q = search.toLowerCase();
    const matchesSearch = inst.name.toLowerCase().includes(q) ||
      (inst.domain ?? '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || inst.status === filterStatus;
    const matchesPlan   = filterPlan   === 'all' || inst.plan   === filterPlan;
    return matchesSearch && matchesStatus && matchesPlan;
  }) ?? [];

  // Stats globales
  const totalStudents = institutions?.reduce((s, i) => s + i._count.students, 0) ?? 0;
  const totalUsers    = institutions?.reduce((s, i) => s + i._count.users,    0) ?? 0;
  const active        = institutions?.filter((i) => i.status === 'ACTIVE').length ?? 0;
  const trial         = institutions?.filter((i) => i.status === 'TRIAL').length  ?? 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Instituciones</h1>
          <p className="text-sm text-muted-foreground">
            {institutions?.length ?? 0} instituciones registradas
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva institución
        </Button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total instituciones', value: institutions?.length ?? 0, icon: BookOpen   },
          { label: 'Activas',             value: active,                    icon: TrendingUp  },
          { label: 'En trial',            value: trial,                     icon: Settings    },
          { label: 'Alumnos totales',     value: totalStudents,             icon: GraduationCap },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o dominio..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activas</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Suspendidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            <SelectItem value="FREE">Gratuito</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Institución</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Usuarios</TableHead>
              <TableHead className="text-center">Alumnos</TableHead>
              <TableHead className="text-center">Cursos</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron instituciones</TableCell>
              </TableRow>
            ) : (
              filtered.map((inst) => {
                const plan   = planConfig[inst.plan]     ?? planConfig.FREE;
                const status = statusConfig[inst.status] ?? statusConfig.ACTIVE;
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{inst.name}</p>
                      {inst.domain && <p className="text-xs text-muted-foreground">{inst.domain}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.color}`}>
                        {plan.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{inst._count.users}</TableCell>
                    <TableCell className="text-center tabular-nums">{inst._count.students}</TableCell>
                    <TableCell className="text-center tabular-nums">{inst._count.courses}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPlanDialog(inst)}>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Cambiar plan / estado
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog crear institución */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva institución</DialogTitle>
            <DialogDescription>
              Se creará la institución y un usuario ADMIN con las credenciales ingresadas.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name"
                render={({ field }) => (
                  <FormItem><FormLabel>Nombre de la institución</FormLabel>
                    <FormControl><Input placeholder="Colegio San Martín" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="adminFirstName"
                  render={({ field }) => (
                    <FormItem><FormLabel>Nombre del admin</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="adminLastName"
                  render={({ field }) => (
                    <FormItem><FormLabel>Apellido del admin</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField control={form.control} name="adminEmail"
                render={({ field }) => (
                  <FormItem><FormLabel>Email del admin</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="adminPassword"
                render={({ field }) => (
                  <FormItem><FormLabel>Contraseña inicial</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="address"
                render={({ field }) => (
                  <FormItem><FormLabel>Dirección (opcional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createInstitution.isPending}>
                  {createInstitution.isPending ? 'Creando...' : 'Crear institución'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog plan */}
      <Dialog open={!!planDialog} onOpenChange={(o) => !o && setPlanDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Plan y estado — {planDialog?.name}</DialogTitle>
          </DialogHeader>
          {planDialog && <PlanDialog institution={planDialog} onClose={() => setPlanDialog(null)} />}
        </DialogContent>
      </Dialog>

    </div>
  );
}