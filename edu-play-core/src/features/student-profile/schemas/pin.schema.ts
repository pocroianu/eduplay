import { z } from 'zod';

const pinField = z
  .string()
  .length(4, 'PIN-ul trebuie să aibă exact 4 cifre')
  .regex(/^\d{4}$/, 'PIN-ul trebuie să conțină doar cifre');

export const changePinSchema = z
  .object({
    currentPin: pinField,
    newPin: pinField,
    confirmPin: z.string(),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    path: ['confirmPin'],
    message: 'Confirmarea PIN-ului nu se potrivește',
  })
  .refine((data) => data.newPin !== data.currentPin, {
    path: ['newPin'],
    message: 'Noul PIN trebuie să fie diferit de cel actual',
  });

export type ChangePinFormData = z.infer<typeof changePinSchema>;
