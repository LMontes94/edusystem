'use client';

import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useResetPassword } from '@/lib/api/users';
import { resetPasswordSchema, ResetPasswordForm } from './users.types';

interface Props {
  open:     boolean;
  onClose:  () => void;
  userId:   string;
  userName: string;
}

export function ResetPasswordDialog({ open, onClose, userId, userName }: Props) {
  const resetPassword = useResetPassword();

  const form = useForm<ResetPasswordForm>({
    resolver:      zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function onSubmit(data: ResetPasswordForm) {
    await resetPassword.mutateAsync({ id: userId, password: data.password });
    onClose();
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña — {userName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="password"
              render={({ field }) => (
                <FormItem><FormLabel>Nueva contraseña</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="confirm"
              render={({ field }) => (
                <FormItem><FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? 'Guardando...' : 'Actualizar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}