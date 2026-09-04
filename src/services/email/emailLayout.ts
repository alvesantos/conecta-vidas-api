export interface EmailLayoutOptions {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}

const BRAND_NAVY = '#01193A';

/** Layout de e-mail com tabelas + estilo inline (compatibilidade máxima com clientes de e-mail). */
export function renderEmailLayout({ heading, bodyHtml, ctaLabel, ctaUrl, unsubscribeUrl }: EmailLayoutOptions): string {
  const cta = ctaLabel && ctaUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td style="border-radius:9999px;background-color:${BRAND_NAVY};">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:9999px;font-family:Arial,Helvetica,sans-serif;">${ctaLabel}</a>
        </td>
      </tr>
    </table>` : '';

  const unsubscribe = unsubscribeUrl ? `
    <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">
      Não quer mais receber esses e-mails? <a href="${unsubscribeUrl}" style="color:#9ca3af;">Descadastrar</a>
    </p>` : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background-color:${BRAND_NAVY};padding:28px 32px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">ConectaVidas</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND_NAVY};">${heading}</h1>
              <div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">ConectaVidas · Cuidando de você e do seu pet.</p>
              ${unsubscribe}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
