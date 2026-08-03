export type ConsultationKind = 'humana' | 'veterinaria';

export function contextFromPetId(petId?: string | null): ConsultationKind {
  return petId ? 'veterinaria' : 'humana';
}

export function isClinicalContextCompatible(kind: ConsultationKind, petId?: string | null): boolean {
  return kind === 'humana' ? !petId : Boolean(petId);
}
