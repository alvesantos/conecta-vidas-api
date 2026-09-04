const apiKey = process.env.ASAAS_API_KEY || '';
const env = process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';
const baseUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

export const asaasConfigured = Boolean(apiKey);

export class AsaasError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
    this.name = 'AsaasError';
  }
}

export async function asaasRequest<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json as { errors?: { description?: string }[] })?.errors?.[0]?.description ?? `Asaas respondeu ${response.status}`;
    throw new AsaasError(message, response.status, json);
  }
  return json as T;
}
