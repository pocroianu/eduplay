import { z } from 'zod';

export const passwordRequirements = z
  .string()
  .min(8, 'Parola trebuie să aibă cel puțin 8 caractere')
  .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
  .regex(/[a-z]/, 'Parola trebuie să conțină cel puțin o literă mică')
  .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră')
  .regex(/[^A-Za-z0-9]/, 'Parola trebuie să conțină cel puțin un caracter special');

export const resetPasswordSchema = z
  .object({
    password: passwordRequirements,
    confirmPassword: z.string().min(1, 'Te rugăm să confirmi parola'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Parolele nu se potrivesc',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Individual password requirement checks for the UI checklist.
 * Each function returns true if the requirement is met.
 */
export const passwordRequirementChecks = {
  minLength: (password: string) => password.length >= 8,
  hasUppercase: (password: string) => /[A-Z]/.test(password),
  hasLowercase: (password: string) => /[a-z]/.test(password),
  hasNumber: (password: string) => /[0-9]/.test(password),
  hasSpecial: (password: string) => /[^A-Za-z0-9]/.test(password),
};

/**
 * Labels for each password requirement (in Romanian)
 */
export const passwordRequirementLabels: Record<keyof typeof passwordRequirementChecks, string> = {
  minLength: 'Cel puțin 8 caractere',
  hasUppercase: 'Cel puțin o literă mare',
  hasLowercase: 'Cel puțin o literă mică',
  hasNumber: 'Cel puțin o cifră',
  hasSpecial: 'Cel puțin un caracter special (!@#$%...)',
};
