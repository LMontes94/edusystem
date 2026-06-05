export interface ChatExportData {
  title: string;
  creator: string;
  createdAt: string;
  level: string | null;
  educationLevelName?: string | null;
  participants: { name: string; role: string }[];
  messages: { senderName: string; senderRole: string; content: string; sentAt: string }[];
  exportedAt: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function chatExportTemplate(data: ChatExportData): string {
  const levelLabel = data.educationLevelName
    ?? (data.level
      ? { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }[data.level] ?? data.level
      : 'General');

  const roleLabel: Record<string, string> = {
    TEACHER: 'Docente',
    PRECEPTOR: 'Preceptor',
    SECRETARY: 'Secretario',
    DIRECTOR: 'Director',
    ADMIN: 'Admin',
    GUARDIAN: 'Tutor',
  };

  const messagesHtml = data.messages
    .map(
      (m) => `
    <div class="message">
      <div class="message-header">
        <span class="message-sender">${escapeHtml(m.senderName)}</span>
        <span class="message-role">${roleLabel[m.senderRole] ?? m.senderRole}</span>
        <span class="message-time">${formatDate(m.sentAt)}</span>
      </div>
      <div class="message-body">${escapeHtml(m.content)}</div>
    </div>`,
    )
    .join('\n');

  const participantsHtml = data.participants
    .map(
      (p) =>
        `<li>${escapeHtml(p.name)} — <span class="role-badge">${roleLabel[p.role] ?? p.role}</span></li>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      color: #1a1a2e;
      line-height: 1.5;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 18pt; color: #1e3a5f; margin-bottom: 4px; }
    .header .meta { font-size: 9pt; color: #64748b; }
    .meta-grid {
      display: flex; gap: 24px; flex-wrap: wrap;
      margin-bottom: 20px; padding: 12px 16px;
      background: #f8fafc; border-radius: 8px;
      font-size: 9pt; color: #475569;
    }
    .meta-grid .label { color: #94a3b8; }
    .participants {
      margin-bottom: 20px;
    }
    .participants h2 {
      font-size: 11pt; color: #1e3a5f; margin-bottom: 8px;
    }
    .participants ul {
      list-style: none; display: flex; flex-wrap: wrap; gap: 6px;
    }
    .participants li {
      font-size: 9pt; padding: 2px 10px;
      background: #f1f5f9; border-radius: 12px;
    }
    .role-badge {
      font-size: 8pt; color: #64748b;
    }
    .messages {
      margin-top: 16px;
    }
    .messages h2 {
      font-size: 11pt; color: #1e3a5f; margin-bottom: 12px;
    }
    .message {
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .message-header {
      display: flex; gap: 8px; align-items: center;
      margin-bottom: 4px; font-size: 9pt;
    }
    .message-sender { font-weight: 600; color: #1e3a5f; }
    .message-role { color: #64748b; }
    .message-time { margin-left: auto; color: #94a3b8; }
    .message-body {
      font-size: 10pt; color: #334155;
      white-space: pre-wrap; word-break: break-word;
    }
    .footer {
      margin-top: 24px; padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt; color: #94a3b8; text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(data.title)}</h1>
    <div class="meta">Exportado el ${formatDate(data.exportedAt)}</div>
  </div>

  <div class="meta-grid">
    <div><span class="label">Creador:</span> ${escapeHtml(data.creator)}</div>
    <div><span class="label">Creado:</span> ${formatDate(data.createdAt)}</div>
    <div><span class="label">Nivel:</span> ${levelLabel}</div>
    <div><span class="label">Mensajes:</span> ${data.messages.length}</div>
  </div>

  <div class="participants">
    <h2>Participantes (${data.participants.length})</h2>
    <ul>${participantsHtml}</ul>
  </div>

  <div class="messages">
    <h2>Mensajes</h2>
    ${messagesHtml}
  </div>

  <div class="footer">
    EduSystem — ${data.messages.length} mensajes · ${formatDate(data.exportedAt)}
  </div>
</body>
</html>`;
}
