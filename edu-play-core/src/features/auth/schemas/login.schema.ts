import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
