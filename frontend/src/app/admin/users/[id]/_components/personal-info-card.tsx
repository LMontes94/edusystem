'use client';

import { useState, useEffect } from 'react';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Save, X, User } from 'lucide-react';
import { useUpdateUser } from '@/lib/api/users';

interface Props {
  user: {
    id:         string;
    firstName:  string;
    lastName:   string;
    email:      string;
    phone?:     string | null;
  };
}

export function PersonalInfoCard({ user }: Props) {
  const [editing,   setEditing]   = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName,  setLastName]  = useState(user.lastName);
  const [phone,     setPhone]     = useState(user.phone ?? '');

  const updateUser = useUpdateUser();

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone ?? '');
  }, [user]);

  async function handleSave() {
    await updateUser.mutateAsync({
      id:   user.id,
      data: { firstName, lastName, phone: phone || undefined },
    });
    setEditing(false);
  }

  function handleCancel() {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone ?? '');
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateUser.isPending}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {updateUser.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground mb-1">Nombre</dt>
            {editing ? (
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8" />
            ) : (
              <dd className="font-medium">{user.firstName}</dd>
            )}
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Apellido</dt>
            {editing ? (
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8" />
            ) : (
              <dd className="font-medium">{user.lastName}</dd>
            )}
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">Teléfono</dt>
            {editing ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8" placeholder="+54 11 1234-5678" />
            ) : (
              <dd className="font-medium">{user.phone ?? '—'}</dd>
            )}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}