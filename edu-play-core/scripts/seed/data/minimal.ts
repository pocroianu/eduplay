import type { SeedTierData } from '../types';

export const minimalData: SeedTierData = {
  tier: 'minimal',
  teachers: [
    {
      id: '00000000-0000-4000-a000-000000000001',
      email: 'teacher@eduplay.ro',
      password: 'password123',
      fullName: 'Maria Popescu',
    },
  ],

  parents: [
    {
      id: '00000000-0000-4000-a000-000000000101',
      email: 'parent@eduplay.ro',
      password: 'password123',
      fullName: 'Ion Ionescu',
      children: [{ username: 'ana.a1', relationshipType: 'father' }],
    },
  ],

  classes: [
    {
      id: '00000000-0000-4000-a000-000000000201',
      name: 'Grupa Albinuțelor',
      description: 'Grupa de preșcolari - Albinuțele',
      gradeLevel: 'preschool',
      schoolYear: '2025-2026',
      teacherEmail: 'teacher@eduplay.ro',
    },
  ],

  students: [
    {
      id: '00000000-0000-4000-a000-000000000301',
      username: 'ana.a1',
      pin: '1234',
      fullName: 'Ana Ionescu',
      dateOfBirth: '2021-03-15',
      className: 'Grupa Albinuțelor',
    },
    {
      id: '00000000-0000-4000-a000-000000000302',
      username: 'mihai.a1',
      pin: '2345',
      fullName: 'Mihai Popa',
      dateOfBirth: '2021-07-22',
      className: 'Grupa Albinuțelor',
    },
    {
      id: '00000000-0000-4000-a000-000000000303',
      username: 'elena.a1',
      pin: '3456',
      fullName: 'Elena Dumitrescu',
      dateOfBirth: '2020-11-08',
      className: 'Grupa Albinuțelor',
    },
  ],

  assignmentsPerClass: 2,
  progressPerStudent: 2,
};
