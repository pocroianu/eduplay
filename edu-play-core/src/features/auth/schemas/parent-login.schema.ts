import { z } from 'zod';
import { passwordRequirements } from './reset-password.schema';

export const parentLoginSchema = z.object({
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
});

export const parentRegisterSchema = z.object({
  email: z.string().email('Email invalid'),
  password: passwordRequirements,
  confirmPassword: z.string().min(1, 'Te rugăm să confirmi parola'),
  fullName: z.string().min(2, 'Numele trebuie să aibă cel puțin 2 caractere'),
  phoneNumber: z.string().optional(),
  inviteCode: z
    .string()
    .transform((val) => val?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '')
    .pipe(
      z.union([
        z.literal(''),
        z
          .string()
          .length(8, 'Codul de invitație trebuie să aibă 8 caractere')
          .regex(/^[A-Z0-9]{8}$/, 'Codul de invitație conține doar litere mari și cifre'),
      ])
    )
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Parolele nu se potrivesc',
  path: ['confirmPassword'],
});

export type ParentLoginFormData = z.infer<typeof parentLoginSchema>;
export type ParentRegisterFormData = z.infer<typeof parentRegisterSchema>;
