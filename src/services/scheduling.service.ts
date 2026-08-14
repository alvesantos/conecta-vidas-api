import { db } from '../database/knex';

type Kind = 'humana' | 'veterinaria';

function minutes(value: string): number {
  const [hour = 0, minute = 0] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function asTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export const schedulingService = {
  specialties(kind?: Kind) {
    const query = db('specialties').where({ active: true }).select('id', 'name', 'kind').orderBy('name');
    if (kind) query.andWhere({ kind });
    return query;
  },

  async professionalSchedule(professionalId: string) {
    const [specialties, availability] = await Promise.all([
      db('professional_specialties as ps').join('specialties as s', 'ps.specialty_id', 's.id')
        .where('ps.professional_id', professionalId).select('s.id', 's.name', 's.kind').orderBy('s.name'),
      db('professional_availability').where({ professional_id: professionalId })
        .select('id', 'weekday', 'start_time', 'end_time', 'slot_minutes').orderBy('weekday').orderBy('start_time'),
    ]);
    return { specialties, availability };
  },

  async replaceProfessionalSchedule(
    professionalId: string,
    userType: string,
    specialtyIds: string[],
    availability: Array<{ weekday: number; start_time: string; end_time: string; slot_minutes?: number }>,
  ) {
    const kind: Kind = userType === 'medico' ? 'humana' : 'veterinaria';
    const validSpecialties = await db('specialties').whereIn('id', specialtyIds).andWhere({ kind, active: true }).select('id');
    if (validSpecialties.length !== specialtyIds.length) throw new Error('Existe uma especialidade inválida para este portal.');
    for (const row of availability) {
      if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 || minutes(row.end_time) <= minutes(row.start_time)) {
        throw new Error('Período de disponibilidade inválido.');
      }
    }
    await db.transaction(async trx => {
      await trx('professional_specialties').where({ professional_id: professionalId }).delete();
      await trx('professional_availability').where({ professional_id: professionalId }).delete();
      if (specialtyIds.length) await trx('professional_specialties').insert(specialtyIds.map(specialty_id => ({ professional_id: professionalId, specialty_id })));
      if (availability.length) await trx('professional_availability').insert(availability.map(row => ({
        professional_id: professionalId,
        weekday: row.weekday,
        start_time: row.start_time,
        end_time: row.end_time,
        slot_minutes: row.slot_minutes ?? 30,
      })));
    });
    return this.professionalSchedule(professionalId);
  },

  async availableSlots(specialtyId: string, date: string) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' });
    if (date < today) throw new Error('Escolha uma data atual ou futura.');
    const specialty = await db('specialties').where({ id: specialtyId, active: true }).first();
    if (!specialty) throw new Error('Especialidade não encontrada.');
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const rows = await db('professional_availability as a')
      .join('professional_specialties as ps', 'a.professional_id', 'ps.professional_id')
      .join('users as u', 'a.professional_id', 'u.id')
      .where({ 'ps.specialty_id': specialtyId, 'a.weekday': weekday, 'u.status': 'active' })
      .select('a.professional_id', 'u.name as professional_name', 'a.start_time', 'a.end_time', 'a.slot_minutes');
    const busy = await db('consultations').where({ date }).whereNot('status', 'cancelada').whereNotNull('vet_id').select('vet_id', 'time');
    const occupied = new Set(busy.map(row => `${row.vet_id}:${String(row.time).slice(0, 5)}`));
    const result: Array<{ professional_id: string; professional_name: string; time: string }> = [];
    const seen = new Set<string>();
    const nowTime = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false });
    for (const row of rows) {
      for (let cursor = minutes(row.start_time); cursor + Number(row.slot_minutes) <= minutes(row.end_time); cursor += Number(row.slot_minutes)) {
        const time = asTime(cursor);
        const key = `${row.professional_id}:${time}`;
        if (!occupied.has(key) && !seen.has(key) && (date !== today || time > nowTime)) {
          seen.add(key);
          result.push({ professional_id: row.professional_id, professional_name: row.professional_name, time });
        }
      }
    }
    return result.sort((a, b) => a.time.localeCompare(b.time) || a.professional_name.localeCompare(b.professional_name));
  },

  async assertSlot(professionalId: string, specialtyId: string, date: string, time: string, ignoreConsultationId?: string) {
    const slots = await this.availableSlots(specialtyId, date);
    const available = slots.some(slot => slot.professional_id === professionalId && slot.time === time.slice(0, 5));
    if (!available) {
      if (ignoreConsultationId) {
        const current = await db('consultations').where({ id: ignoreConsultationId, vet_id: professionalId, specialty_id: specialtyId, date }).first();
        if (current && String(current.time).slice(0, 5) === time.slice(0, 5)) return;
      }
      throw new Error('Este horário não está mais disponível.');
    }
  },
};
