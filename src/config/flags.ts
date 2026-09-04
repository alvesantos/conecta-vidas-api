// Enquanto true, nenhuma cobrança AVULSA real é feita (pronto atendimento /
// especialista fora do plano). Existe porque profissionais ainda não têm
// CNPJ/split configurado — sem isso, tentar cobrar de verdade quebraria o
// fluxo de teste da plataforma. NÃO afeta os planos/assinaturas: esses usam
// o Asaas sandbox, que nunca cobra dinheiro real.
export const isTrialVersion = process.env.THIS_IS_TRIAL_VERSION === 'true';

// Percentual do valor avulso que fica com o profissional (o resto fica com a
// plataforma). Configurável, mas o combinado hoje é 50/50.
export const AVULSO_PROFESSIONAL_SPLIT_PERCENT = Number(process.env.AVULSO_PROFESSIONAL_SPLIT_PERCENT ?? 50);
