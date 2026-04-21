'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMyInstitution, useUpdateInstitution, useInvitations, useCreateInvitation, useRevokeInvitation } from '@/lib/api/institution';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Building2, Mail, Phone, MapPin, Palette, AlertTriangle,
  Plus, Trash2, Copy, Check, UserPlus, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { LogoUpload } from '@/components/logo-upload';

const planConfig = {
  FREE:       { label: 'Gratuito',   color: 'bg-gray-100 text-gray-700'     },
  STARTER:    { label: 'Starter',    color: 'bg-blue-100 text-blue-700'     },
  PRO:        { label: 'Pro',        color: 'bg-purple-100 text-purple-700' },
  ENTERPRISE: { label: 'Enterprise', color: 'bg-amber-100 text-amber-700'   },
};

const statusConfig = {
  ACTIVE:    { label: 'Activa',   color: 'bg-emerald-100 text-emerald-700' },
  TRIAL:     { label: 'Trial',    color: 'bg-blue-100 text-blue-700'       },
  SUSPENDED: { label: 'Suspendida', color: 'bg-red-100 text-red-700'       },
};

const roleLabels: Record<string, string> = {
  ADMIN:     'Administrador', DIRECTOR:  'Director',
  SECRETARY: 'Secretaria',   PRECEPTOR: 'Preceptor',
  TEACHER:   'Docente',      GUARDIAN:  'Tutor',
};

// ── Tab: Datos institucionales ────────────────
function GeneralTab({ institution, onSave }: { institution: any; onSave: (data: any) => void }) {
  const [name,    setName]    = useState(institution.name    ?? '');
  const [address, setAddress] = useState(institution.address ?? '');
  const [phone,   setPhone]   = useState(institution.phone   ?? '');
  const [domain,  setDomain]  = useState(institution.domain  ?? '');
  const update = useUpdateInstitution();

  useEffect(() => {
    setName(institution.name ?? '');
    setAddress(institution.address ?? '');
    setPhone(institution.phone ?? '');
    setDomain(institution.domain ?? '');
  }, [institution]);

  async function handleSave() {
    await update.mutateAsync({
      id:   institution.id,
      data: { name, address, phone, domain: domain || undefined },
    });
  }

  return (    
    <div className="space-y-4 max-w-lg">
      <LogoUpload institutionId={institution.id}/>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nombre de la institución</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Dirección</label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Ejemplo 1234" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Teléfono</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 11 1234-5678" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Dominio</label>
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="colegio.edu.ar" />
        <p className="text-xs text-muted-foreground">Dominio web de la institución (opcional)</p>
      </div>
      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </div>
  );
}

// ── Tab: Configuración de reportes ────────────
function ReportSettingsTab({ institution }: { institution: any }) {
  const settings = (institution.settings ?? {}) as any;
  const report   = settings.report ?? {};

  const [primaryColor,   setPrimaryColor]   = useState(report.primaryColor   ?? '#1e3a5f');
  const [secondaryColor, setSecondaryColor] = useState(report.secondaryColor ?? '#2d6a9f');
  const [textColor,      setTextColor]      = useState(report.textColor      ?? '#1a1a1a');
  const [logoPosition,   setLogoPosition]   = useState(report.logoPosition   ?? 'center');
  const [layout,         setLayout]         = useState(report.layout         ?? 'classic');
  const update = useUpdateInstitution();

  async function handleSave() {
    await update.mutateAsync({
      id:   institution.id,
      data: { settings: { report: { primaryColor, secondaryColor, textColor, logoPosition, layout } } },
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Color primario',    value: primaryColor,   set: setPrimaryColor   },
          { label: 'Color secundario',  value: secondaryColor, set: setSecondaryColor },
          { label: 'Color de texto',    value: textColor,      set: setTextColor      },
        ].map(({ label, value, set }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="h-9 w-9 rounded border cursor-pointer"
              />
              <Input value={value} onChange={(e) => set(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Posición del logo</label>
          <Select value={logoPosition} onValueChange={setLogoPosition}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="left">Izquierda</SelectItem>
              <SelectItem value="none">Sin logo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Diseño del reporte</label>
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Clásico</SelectItem>
              <SelectItem value="institutional">Institucional</SelectItem>
              <SelectItem value="modern">Moderno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </div>
  );
}

// ── Tab: Actas e inasistencias ────────────────
function AbsenceSettingsTab({ institution }: { institution: any }) {
  const settings   = (institution.settings ?? {}) as any;
  const [thresholds, setThresholds] = useState<number[]>(settings.absenceThresholds ?? [10, 20, 30]);
  const [district,   setDistrict]   = useState<string>(settings.district ?? '');
  const [newVal,     setNewVal]     = useState('');
  const update = useUpdateInstitution();

  function addThreshold() {
    const num = parseInt(newVal);
    if (isNaN(num) || num <= 0) return;
    if (thresholds.includes(num)) { toast.warning('Ese umbral ya existe'); return; }
    setThresholds((prev) => [...prev, num].sort((a, b) => a - b));
    setNewVal('');
  }

  async function handleSave() {
    await update.mutateAsync({
      id:   institution.id,
      data: { settings: { absenceThresholds: thresholds, district } },
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Distrito escolar</label>
        <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Ej: Vicente López" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Umbrales de inasistencia</label>
        <p className="text-xs text-muted-foreground">Se genera un acta automáticamente al superar cada umbral</p>
        <div className="flex flex-wrap gap-2">
          {thresholds.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200">
              {t} faltas
              <button onClick={() => setThresholds((prev) => prev.filter((x) => x !== t))} className="hover:opacity-70">
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="number" min={1} max={365} placeholder="Ej: 15"
            value={newVal} onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addThreshold()}
            className="w-28 h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addThreshold}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </div>
  );
}

// ── Tab: Invitaciones ─────────────────────────
function InvitationsTab({ institution }: { institution: any }) {
  const [dialog,    setDialog]    = useState(false);
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState('TEACHER');
  const [copied,    setCopied]    = useState<string | null>(null);
  const [lastLink,  setLastLink]  = useState<string | null>(null);

  const { data: invitations } = useInvitations(institution.id);
  const createInvitation      = useCreateInvitation(institution.id);
  const revokeInvitation      = useRevokeInvitation(institution.id);

  async function handleCreate() {
    const result = await createInvitation.mutateAsync({ email, role });
    if (result.inviteLink) setLastLink(result.inviteLink);
    setDialog(false);
    setEmail('');
    setRole('TEACHER');
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(link);
    setTimeout(() => setCopied(null), 2000);
  }

  const pending  = invitations?.filter((i) => !i.acceptedAt && new Date(i.expiresAt) > new Date()) ?? [];
  const accepted = invitations?.filter((i) => !!i.acceptedAt) ?? [];
  const expired  = invitations?.filter((i) => !i.acceptedAt && new Date(i.expiresAt) <= new Date()) ?? [];

  return (
    <div className="space-y-4">

      {/* Link del último invite */}
      {lastLink && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-emerald-50 border-emerald-200">
          <p className="text-xs text-emerald-700 flex-1 font-mono truncate">{lastLink}</p>
          <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => copyLink(lastLink)}>
            {copied === lastLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {pending.length} pendiente{pending.length !== 1 ? 's' : ''} · {accepted.length} aceptada{accepted.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar usuario
        </Button>
      </div>

      {invitations?.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border rounded-lg border-dashed">
          No hay invitaciones enviadas
        </div>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations?.map((inv) => {
                const isExpired  = !inv.acceptedAt && new Date(inv.expiresAt) <= new Date();
                const isAccepted = !!inv.acceptedAt;
                return (
                  <TableRow key={inv.id} className={isExpired ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{roleLabels[inv.role] ?? inv.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {isAccepted ? (
                        <span className="text-xs text-emerald-600 font-medium">Aceptada</span>
                      ) : isExpired ? (
                        <span className="text-xs text-muted-foreground">Expirada</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      {!isAccepted && !isExpired && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => revokeInvitation.mutate(inv.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog crear invitación */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="docente@colegio.edu.ar" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rol</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Se generará un link de invitación válido por 7 días.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!email || createInvitation.isPending}>
                {createInvitation.isPending ? 'Enviando...' : 'Generar invitación'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Página principal ──────────────────────────
export default function SettingsPage() {
  const { data: institution, isLoading } = useMyInstitution();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando...
      </div>
    );
  }

  if (!institution) return null;

  const plan   = planConfig[institution.plan]   ?? planConfig.FREE;
  const status = statusConfig[institution.status] ?? statusConfig.ACTIVE;

  const trialDaysLeft = institution.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(institution.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Datos y configuración de tu institución</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
            {status.label}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${plan.color}`}>
            {plan.label}
          </span>
        </div>
      </div>

      {/* Banner trial */}
      {institution.status === 'TRIAL' && trialDaysLeft !== null && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            {trialDaysLeft > 0
              ? <>Tu período de prueba vence en <strong>{trialDaysLeft} días</strong>. Contactá a soporte para activar tu plan.</>
              : <>Tu período de prueba <strong>ha vencido</strong>. Contactá a soporte para continuar.</>
            }
          </p>
        </div>
      )}

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Usuarios',  value: institution._count.users    },
          { label: 'Alumnos',   value: institution._count.students  },
          { label: 'Cursos',    value: institution._count.courses   },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold mt-0.5">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Palette className="h-3.5 w-3.5 mr-1.5" />
            Reportes
          </TabsTrigger>
          <TabsTrigger value="absence">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Inasistencias
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invitaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab institution={institution} onSave={() => {}} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportSettingsTab institution={institution} />
        </TabsContent>
        <TabsContent value="absence" className="mt-4">
          <AbsenceSettingsTab institution={institution} />
        </TabsContent>
        <TabsContent value="invitations" className="mt-4">
          <InvitationsTab institution={institution} />
        </TabsContent>
      </Tabs>
    </div>
  );
}