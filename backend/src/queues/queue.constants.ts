// ──────────────────────────────────────────────
// Constantes centralizadas de colas y jobs.
// Usar siempre estas constantes en vez de strings
// literales para evitar typos silenciosos.
// ──────────────────────────────────────────────

export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  AUDIT:         'audit-log',
  GRADES:        'grade-processing',
  PDF:           'pdf-generation',
} as const;

export const JOBS = {
  // Notifications
  GRADE_CREATED:        'grade.created',
  ATTENDANCE_RECORDED:  'attendance.recorded',
  ANNOUNCEMENT_PUBLISHED: 'announcement.published',
  INVITATION_CREATED:   'invitation.created',

  // Audit
  AUDIT_LOG:            'audit.log',

  // Grades
  RECALCULATE_AVERAGE:  'grade.recalculate-average',

  // PDF
  GENERATE_REPORT:      'pdf.generate-report',
} as const;

// Opciones por defecto para jobs
export const JOB_OPTIONS = {
  // Reintentar 3 veces con backoff exponencial
  DEFAULT: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100, // guardar últimos 100 jobs completados
    removeOnFail: 200,     // guardar últimos 200 jobs fallidos
  },
  // Jobs críticos (auditoría) — más reintentos
  CRITICAL: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
  // Jobs de baja prioridad (PDFs)
  LOW_PRIORITY: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
    priority: 10,
  },
} as const;
