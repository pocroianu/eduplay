import { describe, expect, it } from 'vitest';
import {
  pathAssignmentPickerReducer,
  type PathAssignmentPickerState,
} from '../path-assignment-picker-reducer';

const initialState: PathAssignmentPickerState = {
  targetType: 'class',
  classId: '',
  studentId: '',
  dueDate: '',
};

describe('pathAssignmentPickerReducer', () => {
  it('keeps class and student targets mutually exclusive', () => {
    const classState = pathAssignmentPickerReducer(initialState, {
      type: 'selectClass',
      classId: 'class-1',
    });
    expect(classState).toMatchObject({
      targetType: 'class',
      classId: 'class-1',
      studentId: '',
    });

    const studentState = pathAssignmentPickerReducer(classState, {
      type: 'selectStudent',
      studentId: 'student-1',
      classId: 'class-1',
    });
    expect(studentState).toMatchObject({
      targetType: 'student',
      classId: 'class-1',
      studentId: 'student-1',
    });

    const nextClassState = pathAssignmentPickerReducer(studentState, {
      type: 'selectTargetType',
      targetType: 'class',
    });
    expect(nextClassState).toMatchObject({
      targetType: 'class',
      classId: '',
      studentId: '',
    });
  });

  it('resets a selected student when the class changes', () => {
    const state: PathAssignmentPickerState = {
      targetType: 'student',
      classId: 'class-1',
      studentId: 'student-1',
      dueDate: '2026-06-01',
    };

    const next = pathAssignmentPickerReducer(state, {
      type: 'selectClass',
      classId: 'class-2',
    });

    expect(next).toEqual({
      targetType: 'student',
      classId: 'class-2',
      studentId: '',
      dueDate: '2026-06-01',
    });
  });
});
