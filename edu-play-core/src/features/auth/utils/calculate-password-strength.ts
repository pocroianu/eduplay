import zxcvbn from 'zxcvbn';

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
  /** zxcvbn score from 0 (very weak) to 4 (very strong) */
  score: PasswordStrength;
  /** Human-readable label in Romanian */
  label: string;
  /** Color name for the strength indicator bar */
  color: string;
  /** Tailwind CSS color class for the bar background */
  colorClass: string;
  /** Tailwind CSS color class for the label text */
  textColorClass: string;
  /** Percentage of bar to fill (0-100) */
  percentage: number;
}

const strengthMap: Record<PasswordStrength, Omit<PasswordStrengthResult, 'score' | 'percentage'>> = {
  0: {
    label: 'Foarte slabă',
    color: 'red',
    colorClass: 'bg-red-500',
    textColorClass: 'text-red-600',
  },
  1: {
    label: 'Slabă',
    color: 'orange',
    colorClass: 'bg-orange-500',
    textColorClass: 'text-orange-600',
  },
  2: {
    label: 'Acceptabilă',
    color: 'yellow',
    colorClass: 'bg-yellow-500',
    textColorClass: 'text-yellow-600',
  },
  3: {
    label: 'Bună',
    color: 'lightgreen',
    colorClass: 'bg-green-400',
    textColorClass: 'text-green-600',
  },
  4: {
    label: 'Foarte bună',
    color: 'green',
    colorClass: 'bg-green-600',
    textColorClass: 'text-green-700',
  },
};

/**
 * Calculate password strength using the zxcvbn library.
 * Returns a score (0-4), label, color, and percentage for the UI indicator.
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      percentage: 0,
      ...strengthMap[0],
    };
  }

  const result = zxcvbn(password);
  const score = result.score as PasswordStrength;

  return {
    score,
    percentage: ((score + 1) / 5) * 100,
    ...strengthMap[score],
  };
}
