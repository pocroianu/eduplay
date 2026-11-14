export type PathAssignmentTargetType = 'class' | 'student';

export interface PathAssignmentPickerState {
  targetType: PathAssignmentTargetType;
  classId: string;
  studentId: string;
  dueDate: string;
}

export type PathAssignmentPickerAction =
  | { type: 'selectTargetType'; targetType: PathAssignmentTargetType }
  | { type: 'selectClass'; classId: string }
  | { type: 'selectStudent'; studentId: string; classId: string }
  | { type: 'setDueDate'; dueDate: string };

export function pathAssignmentPickerReducer(
  state: PathAssignmentPickerState,
  action: PathAssignmentPickerAction,
): PathAssignmentPickerState {
  if (action.type === 'selectTargetType') {
    return {
      ...state,
      targetType: action.targetType,
      classId: '',
      studentId: '',
    };
  }

  if (action.type === 'selectClass') {
    return {
      ...state,
      classId: action.classId,
      studentId: state.classId === action.classId ? state.studentId : '',
    };
  }

  if (action.type === 'selectStudent') {
    return {
      ...state,
      targetType: 'student',
      classId: action.classId,
      studentId: action.studentId,
    };
  }

  return {
    ...state,
    dueDate: action.dueDate,
  };
}
