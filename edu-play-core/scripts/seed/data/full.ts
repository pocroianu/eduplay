import type {
  SeedTierData,
  SeedTeacher,
  SeedParent,
  SeedClass,
  SeedStudent,
  GradeLevel,
  RelationshipType,
} from '../types';

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------
const UUID_PREFIX = '00000000-0000-4000-c000-';

function fullId(seq: number): string {
  return `${UUID_PREFIX}${seq.toString().padStart(12, '0')}`;
}

// ---------------------------------------------------------------------------
// Name pools
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  'Ana', 'Mihai', 'Elena', 'Andrei', 'Sofia', 'Matei', 'Maria', 'David',
  'Ioana', 'Luca', 'Daria', 'Stefan', 'Emma', 'Radu', 'Maya', 'Denis',
  'Iris', 'Teodora', 'Bogdan', 'Carmen', 'Alexandra', 'Victor', 'Diana',
  'Cristian', 'Bianca', 'Gabriel', 'Laura', 'Robert', 'Alina', 'Tudor',
];

const LAST_NAMES = [
  'Ionescu', 'Popescu', 'Popa', 'Dumitrescu', 'Marinescu', 'Stancu',
  'Radu', 'Moldovan', 'Georgescu', 'Florea', 'Nistor', 'Barbu',
  'Constantin', 'Munteanu', 'Preda', 'Vlad', 'Laz\u0103r', 'Ciobanu',
  'Dragomir', 'Tomescu',
];

const PARENT_FIRST_NAMES = [
  'Ion', 'Ana', 'Vasile', 'Elena', 'Gheorghe', 'Maria', 'Dumitru',
  'Ioana', 'Mihai', 'Adriana', 'Florin', 'Cristina', 'Dan', 'Raluca',
  'Alexandru', 'Simona', 'Marius', 'Daniela', 'Sorin', 'Liliana',
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'mother', 'father', 'guardian', 'mother', 'father', 'mother',
  'father', 'guardian', 'mother', 'father', 'mother', 'father',
  'mother', 'father', 'guardian', 'mother', 'father', 'mother',
  'father', 'mother',
];

// ---------------------------------------------------------------------------
// Teachers (5)
// ---------------------------------------------------------------------------
const teachers: SeedTeacher[] = [
  { id: fullId(1), email: 'teacher1@eduplay.ro', password: 'password123', fullName: 'Maria Popescu' },
  { id: fullId(2), email: 'teacher2@eduplay.ro', password: 'password123', fullName: 'Andrei Vasile' },
  { id: fullId(3), email: 'teacher3@eduplay.ro', password: 'password123', fullName: 'Cristina Moldovan' },
  { id: fullId(4), email: 'teacher4@eduplay.ro', password: 'password123', fullName: 'Gabriel Stanescu' },
  { id: fullId(5), email: 'teacher5@eduplay.ro', password: 'password123', fullName: 'Raluca Gheorghe' },
];

// ---------------------------------------------------------------------------
// Classes (12) - 3 per grade level, distributed across 5 teachers
// ---------------------------------------------------------------------------
interface ClassDef {
  name: string;
  description: string;
  gradeLevel: GradeLevel;
  teacherIndex: number; // 0-based index into teachers array
}

const CLASS_DEFS: ClassDef[] = [
  // Preschool (3)
  { name: 'Grupa Albinu\u021belor', description: 'Grupa de pre\u0219colari - Albinu\u021bele', gradeLevel: 'preschool', teacherIndex: 0 },
  { name: 'Grupa Ursule\u021bilor', description: 'Grupa de pre\u0219colari - Ursule\u021bii', gradeLevel: 'preschool', teacherIndex: 1 },
  { name: 'Grupa Iepura\u0219ilor', description: 'Grupa de pre\u0219colari - Iepura\u0219ii', gradeLevel: 'preschool', teacherIndex: 2 },
  // Kindergarten (3)
  { name: 'Grupa Flutura\u0219ilor', description: 'Grupa de gr\u0103dini\u021b\u0103 - Flutura\u0219ii', gradeLevel: 'kindergarten', teacherIndex: 0 },
  { name: 'Grupa Stelu\u021belor', description: 'Grupa de gr\u0103dini\u021b\u0103 - Stelu\u021bele', gradeLevel: 'kindergarten', teacherIndex: 3 },
  { name: 'Grupa R\u0103s\u0103ritului', description: 'Grupa de gr\u0103dini\u021b\u0103 - R\u0103s\u0103ritul', gradeLevel: 'kindergarten', teacherIndex: 4 },
  // Grade 1 (3)
  { name: 'Clasa I-A', description: 'Clasa I-A', gradeLevel: 'grade-1', teacherIndex: 1 },
  { name: 'Clasa I-B', description: 'Clasa I-B', gradeLevel: 'grade-1', teacherIndex: 2 },
  { name: 'Clasa I-C', description: 'Clasa I-C', gradeLevel: 'grade-1', teacherIndex: 3 },
  // Grade 2 (3)
  { name: 'Clasa a II-a A', description: 'Clasa a II-a A', gradeLevel: 'grade-2', teacherIndex: 4 },
  { name: 'Clasa a II-a B', description: 'Clasa a II-a B', gradeLevel: 'grade-2', teacherIndex: 0 },
  { name: 'Clasa a II-a C', description: 'Clasa a II-a C', gradeLevel: 'grade-2', teacherIndex: 3 },
];

const classes: SeedClass[] = CLASS_DEFS.map((def, i) => ({
  id: fullId(201 + i),
  name: def.name,
  description: def.description,
  gradeLevel: def.gradeLevel,
  schoolYear: '2025-2026',
  teacherEmail: teachers[def.teacherIndex].email,
}));

// ---------------------------------------------------------------------------
// Students (120) - 10 per class, generated programmatically
// ---------------------------------------------------------------------------

/** Return a birth year appropriate for the grade level. */
function birthYearForGrade(grade: GradeLevel): number {
  switch (grade) {
    case 'preschool':
      return 2021; // 2021-2022 range handled below
    case 'kindergarten':
      return 2020;
    case 'grade-1':
      return 2019;
    case 'grade-2':
      return 2018;
  }
}

function generateStudents(): SeedStudent[] {
  const students: SeedStudent[] = [];
  let studentSeq = 301;
  let pinCounter = 1001;
  let nameIndex = 0;

  for (let classIdx = 0; classIdx < classes.length; classIdx++) {
    const cls = classes[classIdx];
    const grade = CLASS_DEFS[classIdx].gradeLevel;
    const baseYear = birthYearForGrade(grade);

    for (let s = 0; s < 10; s++) {
      const firstName = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
      const lastName = LAST_NAMES[nameIndex % LAST_NAMES.length];
      // For preschool, alternate between 2021 and 2022
      const year = grade === 'preschool' ? (s < 5 ? 2021 : 2022) : baseYear;
      const month = ((s * 3 + classIdx) % 12) + 1;
      const day = ((s * 7 + classIdx * 3) % 28) + 1;
      const dob = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      students.push({
        id: fullId(studentSeq),
        username: `${firstName.toLowerCase()}.c${classIdx + 1}`,
        pin: pinCounter.toString(),
        fullName: `${firstName} ${lastName}`,
        dateOfBirth: dob,
        className: cls.name,
      });

      studentSeq++;
      pinCounter++;
      nameIndex++;
    }
  }

  return students;
}

const students = generateStudents();

// ---------------------------------------------------------------------------
// Parents (20) - each linked to ~3 students via deterministic assignment
// ---------------------------------------------------------------------------
function generateParents(): SeedParent[] {
  const parents: SeedParent[] = [];

  for (let p = 0; p < 20; p++) {
    const firstName = PARENT_FIRST_NAMES[p % PARENT_FIRST_NAMES.length];
    const lastName = LAST_NAMES[p % LAST_NAMES.length];

    // Each parent links to students at indices [p*6, p*6+1, p*6+2], wrapping
    const childIndices: number[] = [];
    for (let c = 0; c < 3; c++) {
      childIndices.push((p * 6 + c) % students.length);
    }

    const children = childIndices.map((idx) => ({
      username: students[idx].username,
      relationshipType: RELATIONSHIP_TYPES[p],
    }));

    parents.push({
      id: fullId(101 + p),
      email: `parent${p + 1}@eduplay.ro`,
      password: 'password123',
      fullName: `${firstName} ${lastName}`,
      children,
    });
  }

  return parents;
}

const parents = generateParents();

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const fullData: SeedTierData = {
  tier: 'full',
  teachers,
  parents,
  classes,
  students,
  assignmentsPerClass: 6,
  progressPerStudent: 8,
};
