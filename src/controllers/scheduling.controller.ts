import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { schedulingService } from '../services/scheduling.service';

export const schedulingController = {
  async specialties(req: AuthRequest, res: Response) {
    const kind = req.query['kind'] === 'veterinaria' ? 'veterinaria' : req.query['kind'] === 'humana' ? 'humana' : undefined;
    return res.json(await schedulingService.specialties(kind));
  },
  async slots(req: AuthRequest, res: Response) {
    try {
      const specialtyId = String(req.query['specialty_id'] || '');
      const date = String(req.query['date'] || '');
      if (!specialtyId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Especialidade e data são obrigatórias.' });
      return res.json(await schedulingService.availableSlots(specialtyId, date));
    } catch (err) { return res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao consultar horários.' }); }
  },
  async mine(req: AuthRequest, res: Response) {
    if (!['medico', 'veterinario'].includes(req.userType || '')) return res.status(403).json({ error: 'Acesso restrito a profissionais.' });
    return res.json(await schedulingService.professionalSchedule(req.userId!));
  },
  async replaceMine(req: AuthRequest, res: Response) {
    if (!['medico', 'veterinario'].includes(req.userType || '')) return res.status(403).json({ error: 'Acesso restrito a profissionais.' });
    try {
      const specialtyIds = Array.isArray(req.body.specialty_ids) ? req.body.specialty_ids.map(String) : [];
      const availability = Array.isArray(req.body.availability) ? req.body.availability : [];
      return res.json(await schedulingService.replaceProfessionalSchedule(req.userId!, req.userType!, specialtyIds, availability));
    } catch (err) { return res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar agenda.' }); }
  },
};
