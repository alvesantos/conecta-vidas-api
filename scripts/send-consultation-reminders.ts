import 'dotenv/config';
import { consultationEmailService } from '../src/services/consultationEmail.service';
import { db } from '../src/database/knex';

consultationEmailService.upcomingReminders()
  .then(count => console.log(`${count} lembrete(s) enviado(s).`))
  .finally(() => db.destroy());
