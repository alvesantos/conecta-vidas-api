import 'dotenv/config';
import { marketingEmailService } from '../src/services/marketingEmail.service';
import { db } from '../src/database/knex';

// Uso: npm run marketing:send -- "Assunto" "Título do e-mail" "Primeiro parágrafo" "Segundo parágrafo" ...
// Sem argumentos, usa o texto padrão de boas-vindas/segurança.
const [subjectArg, headingArg, ...bodyArgs] = process.argv.slice(2);

const subject = subjectArg || 'Você e seu pet, sempre seguros · ConectaVidas';
const heading = headingArg || 'Você e seu pet, sempre seguros.';
const body = bodyArgs.length ? bodyArgs : [
  'Na ConectaVidas, cuidar de quem você ama fica mais simples: consultas médicas e veterinárias, prontuário, receitas e pronto atendimento, tudo num só lugar, quando você mais precisar.',
  'Dá uma olhada no que tem disponível pra você agora mesmo na plataforma.',
];

marketingEmailService.sendCampaign(subject, heading, body)
  .then(result => console.log(`Campanha enviada: ${JSON.stringify(result)}`))
  .finally(() => db.destroy());
