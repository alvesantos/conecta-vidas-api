import { db } from '../database/knex';
import { randomBytes } from 'node:crypto';

export interface CreateConsultationDTO {
  vet_id?: string | null;
  tutor_id: string;
  pet_id?: string | null;
  dependent_id?: string | null;
  specialty_id?: string | null;
  date: string;
  time: string;
  notes?: string;
  is_free?: boolean;
  charged_value?: number | null;
  care_mode?: 'pronto' | 'especialista';
  kind: 'humana' | 'veterinaria';
}

export const consultationService = {
  /**
   * Entrega (ou cria) a sala gratuita do Jitsi apenas a um participante da
   * consulta. O nome aleatório evita as antigas URLs previsíveis pelo ID.
   *
   * A instância pública do meet.jit.si não aceita revogação de URL: o backend
   * controla a entrega do endereço, mas um endereço já compartilhado continua
   * sendo responsabilidade dos participantes.
   */
  async getOrCreateVideoRoom(
    consultationId: string,
    userId: string,
    userType: 'tutor' | 'admin' | 'veterinario' | 'medico',
  ) {
    const consultation = await db('consultations')
      .where({ id: consultationId })
      .select('id', 'tutor_id', 'vet_id', 'status', 'kind', 'meet_link')
      .first();

    if (!consultation) throw new Error('Consulta não encontrada.');

    const isPatient = userType === 'tutor' && consultation.tutor_id === userId;
    const isAssignedProfessional =
      consultation.vet_id === userId &&
      (userType === 'admin' ||
        (consultation.kind === 'humana' && userType === 'medico') ||
        (consultation.kind === 'veterinaria' && userType === 'veterinario'));

    if (!isPatient && !isAssignedProfessional) {
      throw new Error('Você não possui acesso à sala desta consulta.');
    }
    if (!['agendada', 'confirmada'].includes(consultation.status)) {
      throw new Error('Esta sala não está mais disponível.');
    }
    if (isPatient && !consultation.vet_id) {
      throw new Error('Aguarde um profissional assumir o atendimento.');
    }

    const legacyPredictableLink = `https://meet.jit.si/ConectaVet-${consultationId}`;
    if (!consultation.meet_link || consultation.meet_link === legacyPredictableLink) {
      const roomName = `ConectaVidas-${randomBytes(24).toString('hex')}`;
      const generatedLink = `https://meet.jit.si/${roomName}`;

      // Evita gerar duas salas quando paciente e profissional entram juntos.
      const update = db('consultations').where({ id: consultationId });
      if (consultation.meet_link === legacyPredictableLink) {
        update.andWhere('meet_link', legacyPredictableLink);
      } else {
        update.whereNull('meet_link');
      }
      await update.update({ meet_link: generatedLink, updated_at: db.fn.now() });
    }

    const current = await db('consultations')
      .where({ id: consultationId })
      .select('meet_link')
      .first();
    const meetLink = String(current?.meet_link ?? '');
    const roomName = meetLink.split('/').filter(Boolean).pop();
    if (!roomName) throw new Error('Não foi possível preparar a sala.');

    return {
      provider: 'jitsi-public',
      domain: 'meet.jit.si',
      room_name: roomName,
      meet_link: meetLink,
      display_name_role: isPatient ? 'patient' : 'professional',
      recording_enabled: false,
    };
  },

  async create(data: CreateConsultationDTO) {
    const isFree = data.is_free ?? false;
    const [consultation] = await db('consultations').insert({
      vet_id: data.vet_id ?? null,
      tutor_id: data.tutor_id,
      pet_id: data.pet_id ?? null,
      dependent_id: data.dependent_id ?? null,
      specialty_id: data.specialty_id ?? null,
      date: data.date,
      time: data.time,
      notes: data.notes ?? '',
      status: 'agendada',
      is_free: isFree,
      charged_value: isFree ? 0 : data.charged_value ?? null,
      care_mode: data.care_mode ?? 'especialista',
      kind: data.kind,
    }).returning('*');

    return consultation;
  },

  async findByTutor(tutorId: string) {
    return db('consultations as c')
      .leftJoin('users as vet', 'c.vet_id', 'vet.id')
      .leftJoin('pets as p', 'c.pet_id', 'p.id')
      .leftJoin('human_dependents as d', 'c.dependent_id', 'd.id')
      .where('c.tutor_id', tutorId)
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes',
        'c.is_free', 'c.charged_value', 'c.care_mode', 'c.kind', 'c.pet_id', 'c.dependent_id', 'c.specialty_id',
        'vet.name as vet_name',
        's.name as specialty_name',
        'p.name as pet_name',
        'd.name as dependent_name',
        'c.created_at'
      )
      .leftJoin('specialties as s', 'c.specialty_id', 's.id')
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');
  },

  async findAll() {
    return db('consultations as c')
      .join('users as tutor', 'c.tutor_id', 'tutor.id')
      .leftJoin('users as vet', 'c.vet_id', 'vet.id')
      .leftJoin('pets as p', 'c.pet_id', 'p.id')
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes', 'c.vet_id',
        'tutor.name as tutor_name',
        'vet.name as vet_name',
        'p.name as pet_name',
        'c.created_at'
      )
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');
  },

  async assignVet(id: string, vetId: string) {
    return db('consultations')
      .where({ id })
      .update({ vet_id: vetId, updated_at: db.fn.now() });
  }
};
