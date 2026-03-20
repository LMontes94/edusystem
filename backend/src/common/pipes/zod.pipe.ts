import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

// ──────────────────────────────────────────────
// ZodPipe — valida el body de un request contra
// un schema Zod. Si la validación falla, lanza
// BadRequestException con los errores detallados.
//
// Uso en controller:
//   @Body(new ZodPipe(LoginSchema)) dto: LoginDto
// ──────────────────────────────────────────────

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestException(messages);
    }

    return result.data;
  }
}
