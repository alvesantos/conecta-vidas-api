import { db } from '../database/knex';
import logger from '../logger';

const apiKey = process.env.RESEND_API_KEY || '';
const from = process.env.RESEND_FROM_EMAIL || 'ConectaVidas <atendimento@example.com>';

async function send(to: string, subject: string, text: string): Promise<boolean> {
  if (!apiKey || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}`);
  return true;
}

async function data(consultationId: string) {
  return db('consultations as c')
    .join('users as patient', 'c.tutor_id', 'patient.id')
    .leftJoin('users as professional', 'c.vet_id', 'professional.id')
    .leftJoin('specialties as specialty', 'c.specialty_id', 'specialty.id')
    .where('c.id', consultationId)
    .select('c.id', 'c.date', 'c.time', 'c.kind', 'patient.email', 'patient.name', 'professional.name as professional_name', 'specialty.name as specialty_name')
    .first();
}

export const consultationEmailService = {
  async confirmation(consultationId: string) {
    try {
      const row = await data(consultationId);
      if (!row) return;
      await send(row.email, 'Consulta agendada · ConectaVidas',
        `Olá, ${row.name}. Sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} foi agendada para ${String(row.date).slice(0, 10)} às ${String(row.time).slice(0, 5)}${row.professional_name ? ` com ${row.professional_name}` : ''}.`);
    } catch (err) { logger.warn('Falha ao enviar confirmação pelo Resend', { consultationId, message: err instanceof Error ? err.message : String(err) }); }
  },

  async upcomingReminders() {
    if (!apiKey) return 0;
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
      const delivered = await send(row.email, 'Lembrete de consulta · ConectaVidas',
        `Olá, ${row.name}. Lembramos que sua consulta${row.specialty_name ? ` de ${row.specialty_name}` : ''} será amanhã às ${String(row.time).slice(0, 5)}${row.professional_name ? ` com ${row.professional_name}` : ''}.`);
      if (delivered) {
        await db('consultation_email_events').insert({ consultation_id: row.id, type: 'reminder_24h' }).onConflict(['consultation_id', 'type']).ignore();
        sent++;
      }
    }
    return sent;
  },
};
