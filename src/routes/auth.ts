import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

const ActivateSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula.')
    .regex(/[0-9]/, 'Debe incluir al menos un número.')
});

router.post('/activate', async (req: Request, res: Response) => {
  const parsed = ActivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data: allowedUser } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (!allowedUser) {
      return res.status(403).json({ error: 'Tu correo no está autorizado para acceder a Aurora.' });
    }

    if (allowedUser.activated) {
      return res.status(400).json({ error: 'Esta cuenta ya fue activada. Por favor, inicia sesión.' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(500).json({ error: authError.message });
    }

    await supabaseAdmin
      .from('authorized_users')
      .update({ activated: true })
      .eq('email', normalizedEmail);

    await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      email: normalizedEmail,
      full_name: allowedUser.full_name
    });

    return res.json({ success: true, message: '¡Cuenta activada con éxito! Ya puedes entrar.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;