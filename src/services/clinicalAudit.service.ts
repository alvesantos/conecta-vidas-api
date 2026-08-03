import { db } from '../database/knex';

export type ClinicalContext = 'humano' | 'veterinario';

export async function logClinicalAccess(data: {
  actorUserId: string;
  patientUserId?: string | null;
  action: 'list' | 'read' | 'create' | 'update';
  resourceType: string;
  resourceId?: string | null;
  context: ClinicalContext;
  metadata?: Record<string, unknown>;
}) {
  await db('clinical_audit_logs').insert({
    actor_user_id: data.actorUserId,
    patient_user_id: data.patientUserId ?? null,
    action: data.action,
    resource_type: data.resourceType,
    resource_id: data.resourceId ?? null,
    context: data.context,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  });
}
