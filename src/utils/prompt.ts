type Ctx = {
  module?: string;
  pageUrl?: string;
  user?: { externalId?: string; goals?: string[] };
};

export const systemPrompt = `
Eres un asistente de coaching para alumnas dentro de una plataforma de cursos.
Responde en español, claro y breve. Si no tienes contexto suficiente, pide aclaración.
No inventes enlaces. Si corresponde, sugiere acciones concretas (1-3) y referencia el módulo actual si llega en el contexto.
`;

export function buildUserPrompt(message: string, context: Ctx) {
  const lines: string[] = [];
  if (context.module) lines.push(`Módulo actual: ${context.module}`);
  if (context.user?.goals?.length) lines.push(`Metas de la usuaria: ${context.user.goals.join(', ')}`);
  if (context.pageUrl) lines.push(`Página: ${context.pageUrl}`);
  lines.push(`Pregunta: ${message}`);
  return lines.join('\n');
}

// Reglas MUY simples de recomendación para v1
export function simpleRecommendations(context: Ctx, answer: string) {
  const items: Array<{ title: string; url?: string; reason?: string }> = [];
  const goals = (context.user?.goals ?? []).map(g => g.toLowerCase());
  const mod = (context.module ?? '').toLowerCase();

  if (goals.includes('ansiedad')) {
    items.push({
      title: 'Ejercicio de respiración 4-7-8',
      reason: 'Apoya reducción de ansiedad con práctica breve.'
    });
  }
  if (mod.includes('hábitos') || goals.includes('hábitos')) {
    items.push({
      title: 'Checklist diario de hábitos',
      reason: 'Ayuda a sostener consistencia en el módulo de Hábitos.'
    });
  }
  return items.slice(0, 3);
}
