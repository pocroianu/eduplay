import { z } from 'zod';

export const studentLoginSchema = z.object({
  username: z.string().min(3, 'Numele de utilizator trebuie să aibă cel puțin 3 caractere'),
  pin: z.string()
    .length(4, 'PIN-ul trebuie să aibă exact 4 cifre')
    .regex(/^\d{4}$/, 'PIN-ul trebuie să conțină doar cifre'),
});

export type StudentLoginFormData = z.infer<typeof studentLoginSchema>;
