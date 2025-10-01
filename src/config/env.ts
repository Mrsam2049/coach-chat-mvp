import 'dotenv/config';

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '8787', 10),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8787')
    .split(',')
    .map(s => s.trim())
};
