import { z } from 'zod'

export const createStudentSchema = z.object({
  fullName: z.string().min(2, 'Numele trebuie să aibă cel puțin 2 caractere'),
  username: z.string().min(3, 'Numele de utilizator trebuie să aibă cel puțin 3 caractere'),
  password: z.string().min(4, 'Parola trebuie să aibă cel puțin 4 caractere'),
  classId: z.string().optional(),
  dateOfBirth: z.string().optional(),
})

export const createClassSchema = z.object({
  name: z.string().min(2, 'Numele clasei trebuie să aibă cel puțin 2 caractere'),
  description: z.string().optional(),
  gradeLevel: z.enum(['preschool', 'kindergarten', 'grade-1', 'grade-2']).optional(),
  schoolYear: z.string().optional(),
})

export type CreateStudentFormData = z.infer<typeof createStudentSchema>
export type CreateClassFormData = z.infer<typeof createClassSchema>
