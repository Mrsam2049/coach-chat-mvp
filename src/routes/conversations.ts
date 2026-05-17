import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { supabaseForUser } from '../services/supabase.js';
import { getAuthContext } from '../utils/auth.js';

const router = Router();

const CreateConversationSchema = z.object({
  title: z.string().min(1).max(120).optional()
});

// Tope de tamaño del contenido de un mensaje (evita abuso de almacenamiento).
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000)
});

const TitleSchema = z.object({
  title: z.string().min(1).max(120)
});

/**
 * Resuelve el contexto de auth y entrega un cliente Supabase con el JWT
 * de la alumna → las políticas RLS SÍ aplican. Devuelve null si no hay
 * sesión válida (el caller responde 401).
 */
async function authed(req: Request) {
  const ctx = await getAuthContext(req.headers.authorization);
  if (!ctx) return null;
  return { user: ctx.user, db: supabaseForUser(ctx.token) };
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const { data, error } = await a.db
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', a.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return res.json({ conversations: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const { title } = CreateConversationSchema.parse(req.body);

    const { data, error } = await a.db
      .from('conversations')
      .insert({
        user_id: a.user.id,
        title: title || 'Nueva conversación'
      })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ conversation: data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const conversationId = req.params.id;

    const { data: convo, error: convoError } = await a.db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', a.user.id)
      .single();

    if (convoError || !convo) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const { data, error } = await a.db
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json({ messages: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const conversationId = req.params.id;
    const { role, content } = MessageSchema.parse(req.body);

    const { data: convo, error: convoError } = await a.db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', a.user.id)
      .single();

    if (convoError || !convo) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const { data, error } = await a.db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content
      })
      .select('id, role, content, created_at')
      .single();

    if (error) throw error;

    await a.db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', a.user.id);

    return res.status(201).json({ message: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const conversationId = req.params.id;
    const { title } = TitleSchema.parse(req.body);

    const { data: convo, error: convoError } = await a.db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', a.user.id)
      .single();

    if (convoError || !convo) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const { data, error } = await a.db
      .from('conversations')
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', a.user.id)
      .select('id, title, created_at, updated_at')
      .single();

    if (error) throw error;

    return res.json({ conversation: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await authed(req);
    if (!a) return res.status(401).json({ error: 'No autorizado' });

    const conversationId = req.params.id;

    const { data: convo, error: convoError } = await a.db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', a.user.id)
      .single();

    if (convoError || !convo) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    await a.db
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    const { error } = await a.db
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', a.user.id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
