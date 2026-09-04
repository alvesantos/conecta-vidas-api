import { db } from '../database/knex';
import logger from '../logger';
import { sendEmail, resendConfigured } from './email/resendClient';
import { renderEmailLayout } from './email/emailLayout';

async function data(consultationId: string) {
  return db('consultations as c')
    .join('users as patient', 'c.tutor_id', 'patient.id')
    .leftJoin('users as professional', 'c.vet_id', 'professional.id')
    .leftJoin('specialties as specialty', 'c.specialty_id', 'specialty.id')
    .where('c.id', consultationId)
    .select('c.id', 'c.date', 'c.time', 'c.kind', 'patient.email', 'patient.name', 'professional.name as professional_name', 'specialty.name as specialty_name')
    .first();
}

function platformUrl() {
  return process.env.PLATFORM_URL || 'http://localhost:3000';
}

export const consultationEmailService = {
  async confirmation(consultationId: string) {
    try {
      const row = await data(consultationId);
      if (!row) return;
      const dateStr = String(row.date).slice(0, 10);
      const timeStr = String(row.time).slice(0, 5);
      const bodyHtml =
        `<p style="margin:0 0 16px;">Olá, ${row.name?.split(' ')[0] || ''}!</p>` +
        `<p style="margin:0 0 16px;">Sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} foi agendada para <strong>${dateStr} às ${timeStr}</strong>${row.professional_name ? ` com ${row.professional_name}` : ''}.</p>` +
        `<p style="margin:0;">No dia, acesse a plataforma e entre em "Consultas" no horário marcado para abrir a sala de atendimento.</p>`;
      const html = renderEmailLayout({
        heading: 'Consulta agendada',
        bodyHtml,
        ctaLabel: 'Acessar a plataforma',
        ctaUrl: platformUrl(),
      });
      const text = `Olá, ${row.name}. Sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} foi agendada para ${dateStr} às ${timeStr}${row.professional_name ? ` com ${row.professional_name}` : ''}.`;
      await sendEmail(row.email, 'Consulta agendada · ConectaVidas', html, text);
    } catch (err) { logger.warn('Falha ao enviar confirmação pelo Resend', { consultationId, message: err instanceof Error ? err.message : String(err) }); }
  },

  async upcomingReminders() {
    if (!resendConfigured) return 0;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' });
    const rows = await db('consultations as c')
      .join('users as patient', 'c.tutor_id', 'patient.id')
      .leftJoin('users as professional', 'c.vet_id', 'professional.id')
      .leftJoin('specialties as specialty', 'c.specialty_id', 'specialty.id')
      .leftJoin('consultation_email_events as event', function () {
        this.on('event.consultation_id', '=', 'c.id').andOn(db.raw("event.type = 'reminder_24h'"));
      })
      .where('c.date', tomorrow).whereNotIn('c.status', ['cancelada', 'realizada']).whereNull('event.id')
      .select('c.id', 'c.date', 'c.time', 'patient.email', 'patient.name', 'professional.name as professional_name', 'specialty.name as specialty_name');
    let sent = 0;
    for (const row of rows) {
      const timeStr = String(row.time).slice(0, 5);
      const bodyHtml =
        `<p style="margin:0 0 16px;">Olá, ${row.name?.split(' ')[0] || ''}!</p>` +
        `<p style="margin:0;">Lembramos que sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} será amanhã às <strong>${timeStr}</strong>${row.professional_name ? ` com ${row.professional_name}` : ''}.</p>`;
      const html = renderEmailLayout({
        heading: 'Sua consulta é amanhã',
        bodyHtml,
        ctaLabel: 'Acessar a plataforma',
        ctaUrl: platformUrl(),
      });
      const text = `Olá, ${row.name}. Lembramos que sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} será amanhã às ${timeStr}${row.professional_name ? ` com ${row.professional_name}` : ''}.`;
      try {
        const delivered = await sendEmail(row.email, 'Lembrete de consulta · ConectaVidas', html, text);
        if (delivered) {
          await db('consultation_email_events').insert({ consultation_id: row.id, type: 'reminder_24h' }).onConflict(['consultation_id', 'type']).ignore();
          sent++;
        }
      } catch (err) { logger.warn('Falha ao enviar lembrete pelo Resend', { consultationId: row.id, message: err instanceof Error ? err.message : String(err) }); }
    }
    return sent;
  },
};
