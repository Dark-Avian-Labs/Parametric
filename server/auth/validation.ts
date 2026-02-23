import type { Response } from 'express';
import { z } from 'zod';

const flexBool = z.preprocess(
  (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on',
  z.boolean(),
);

const positiveInt = z.coerce.number().int().positive();

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const registerSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required.'),
    password: z.string().min(1, 'Password is required.'),
    confirm_password: z.string().min(1, 'Confirm password is required.'),
    is_admin: flexBool,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const gameAccessSchema = z.object({
  user_id: positiveInt,
  game_id: z.string().trim().min(1, 'game_id is required.'),
  enabled: flexBool,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required.'),
  new_password: z
    .string()
    .min(8, 'New password must be at least 8 characters.'),
});

export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  res: Response,
): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Invalid input';
    res.status(400).json({ error: firstError });
    return null;
  }
  return result.data;
}
