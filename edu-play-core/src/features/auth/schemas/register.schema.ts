import { z } from 'zod';
import { passwordRequirements } from './reset-password.schema';

export const registerSchema = z.object({
  email: z.string().email('Email invalid'),
  password: passwordRequirements,
  confirmPassword: z.string().min(1, 'Te rugăm să confirmi parola'),
  fullName: z.string().min(2, 'Numele trebuie să aibă cel puțin 2 caractere'),
  role: z.enum(['teacher', 'parent']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Parolele nu se potrivesc',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;
