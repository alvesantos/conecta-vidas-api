export type MarketingTemplateKey = 'bem_vindo' | 'consulta_marcada' | 'sentimos_sua_falta';

export const MARKETING_TEMPLATE_KEYS: MarketingTemplateKey[] = ['bem_vindo', 'consulta_marcada', 'sentimos_sua_falta'];

export interface RenderedTemplate {
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
}

/**
 * Templates com dados de exemplo, usados na tela de teste do admin pra
 * visualizar o design antes de usar de verdade (campanha real ou gatilho automático).
 */
export function buildSampleTemplate(key: MarketingTemplateKey, name: string): RenderedTemplate {
  switch (key) {
    case 'bem_vindo':
      return {
        subject: 'Bem-vindo à ConectaVidas!',
        heading: `Bem-vindo(a), ${name}!`,
        bodyHtml:
          '<p style="margin:0 0 16px;">Que bom ter você com a gente. Na ConectaVidas, cuidar de quem você ama fica mais simples: consultas médicas e veterinárias, prontuário, receitas e pronto atendimento, tudo num só lugar.</p>' +
          '<p style="margin:0;">Você e seu pet, sempre seguros.</p>',
        ctaLabel: 'Começar agora',
      };
    case 'consulta_marcada':
      return {
        subject: 'Consulta agendada · ConectaVidas',
        heading: 'Sua consulta foi marcada',
        bodyHtml:
          `<p style="margin:0 0 16px;">Olá, ${name}!</p>` +
          '<p style="margin:0 0 16px;">Sua consulta de <strong>Cardiologia</strong> foi agendada para <strong>12/09/2026 às 14:30</strong> com <strong>Dr. João Silva</strong>.</p>' +
          '<p style="margin:0;">No dia, acesse a plataforma e entre em "Consultas" no horário marcado para abrir a sala de atendimento.</p>',
        ctaLabel: 'Ver minhas consultas',
      };
    case 'sentimos_sua_falta':
      return {
        subject: 'Sentimos sua falta · ConectaVidas',
        heading: 'Sentimos sua falta, e seu pet também sente a nossa',
        bodyHtml:
          `<p style="margin:0 0 16px;">Olá, ${name}! Faz um tempinho que você não aparece por aqui.</p>` +
          '<p style="margin:0;">Estamos sempre prontos pra cuidar de você e do seu pet — dá uma olhada no que mudou na plataforma.</p>',
        ctaLabel: 'Voltar à plataforma',
      };
  }
}
