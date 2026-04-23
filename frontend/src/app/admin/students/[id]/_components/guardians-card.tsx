'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface Guardian {
  relationship: string;
  isPrimary:    boolean;
  user: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
  };
}

interface Props {
  guardians: Guardian[];
}

export function GuardiansCard({ guardians }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Tutores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {guardians.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin tutores vinculados</p>
        ) : (
          <div className="space-y-2">
            {guardians.map((g) => (
              <div
                key={g.user.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {g.user.firstName} {g.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{g.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {g.relationship.toLowerCase()}
                  </span>
                  {g.isPrimary && <Badge variant="outline">Principal</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}