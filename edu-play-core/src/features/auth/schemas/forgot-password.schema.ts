import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Adresa de email este obligatorie')
    .trim()
    .toLowerCase()
    .email('Te rugăm să introduci o adresă de email validă'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
