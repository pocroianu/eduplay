export type GradeLevel = 'preschool' | 'kindergarten' | 'grade-1' | 'grade-2';
export type GameCategory = 'literacy' | 'math' | 'phonics' | 'shapes' | 'colors' | 'vocabulary';
export type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface SeedTeacher {
  id: string;
  email: string;
  password: string;
  fullName: string;
}

export interface SeedParent {
  id: string;
  email: string;
  password: string;
  fullName: string;
  children: { username: string; relationshipType: RelationshipType }[];
}

export interface SeedClass {
  id: string;
  name: string;
  description: string;
  gradeLevel: GradeLevel;
  schoolYear: string;
  teacherEmail: string;
}

export interface SeedStudent {
  id: string;
  username: string;
  pin: string;
  fullName: string;
  dateOfBirth: string;
  className: string;
}

export interface SeedTierData {
  tier: 'minimal' | 'medium' | 'full';
  teachers: SeedTeacher[];
  parents: SeedParent[];
  classes: SeedClass[];
  students: SeedStudent[];
  assignmentsPerClass: number;
  progressPerStudent: number;
}
