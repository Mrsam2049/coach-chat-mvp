# Coach Chat MVP (v1 sin BD)

- Node 20 + TypeScript + Express
- Endpoint: `/api/v1/chat`
- Widget estático: `/widget`
- Seguridad: Helmet, CORS allowlist, rate limiting, Zod

## ⚙️ Desarrollo Local
Para iniciar el proyecto en tu máquina local:
```bash
npm ci
cp .env.example .env  # Copia y completa tu OPENAI_API_KEY y variables
npm run dev
# Accede a http://localhost:8787/widget/ para probar