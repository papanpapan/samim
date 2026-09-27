import { Request, Response } from 'express';
import { z } from 'zod';
import { buildPreview, executeIntent, VOICE_INTENTS, type VoiceIntent } from '../services/voiceAgent.service';

export const parseSchema = z.object({
  text: z.string().trim().min(1).max(800),
  lang: z.string().trim().min(2).max(12).optional(),
});

export const executeSchema = z.object({
  intent: z.object({
    name: z.enum(VOICE_INTENTS),
    args: z.record(z.union([z.string(), z.number()])).default({}),
    confidence: z.number().min(0).max(1).optional(),
  }),
  confirmed: z.boolean().default(true),
});

export async function parseVoiceAgent(req: Request, res: Response): Promise<void> {
  const { text, lang } = req.body as z.infer<typeof parseSchema>;
  const preview = await buildPreview(text, req.user?.name, lang);
  res.json({ success: true, data: preview });
}

export async function executeVoiceAgent(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof executeSchema>;
  if (!body.confirmed) {
    res.status(400).json({ success: false, error: { message: 'Confirmation required' } });
    return;
  }
  const intent: VoiceIntent = {
    name: body.intent.name,
    args: body.intent.args,
    confidence: body.intent.confidence ?? 0.8,
  };
  const result = await executeIntent(intent, req.user!.id, req.user?.name);
  res.json({ success: true, data: result });
}
