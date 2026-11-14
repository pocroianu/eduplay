'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/components/ui/Icon';
import { calculatePasswordStrength } from '../utils/calculate-password-strength';
import { passwordRequirementChecks } from '../schemas/reset-password.schema';

interface PasswordStrengthIndicatorProps {
  /** The current password value to evaluate */
  password: string;
}

/**
 * Visual password strength indicator with:
 * - Color-coded progress bar (red -> yellow -> green)
 * - Text label showing strength level
 * - Checklist of individual requirements with check/cross icons
 */
export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('auth');
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  const requirements = useMemo(() => {
    return Object.entries(passwordRequirementChecks).map(([key, check]) => ({
      key,
      label: t(`passwordStrength.requirements.${key}`),
      met: check(password),
    }));
  }, [password, t]);

  // Map strength to Tailwind color classes
  const barColor = useMemo(() => {
    switch (strength.score) {
      case 0: return 'bg-error';
      case 1: return 'bg-gold';
      case 2: return 'bg-primary';
      case 3: return 'bg-primary';
      case 4: return 'bg-primary';
      default: return 'bg-outline-variant';
    }
  }, [strength.score]);

  const textColor = useMemo(() => {
    switch (strength.score) {
      case 0: return 'text-error';
      case 1: return 'text-gold';
      case 2: return 'text-primary';
      case 3: return 'text-primary';
      case 4: return 'text-primary';
      default: return 'text-on-surface-variant';
    }
  }, [strength.score]);

  if (!password) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      {/* Strength bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-on-surface-variant font-medium">
            {t('passwordStrength.label')}
          </span>
          <span className={`text-xs font-semibold ${textColor}`}>
            {t(`passwordStrength.score.${strength.score}`)}
          </span>
        </div>
        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-in-out ${barColor}`}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="flex flex-col gap-1">
        {requirements.map(({ key, label, met }) => (
          <div key={key} className="flex items-center gap-2">
            {met ? (
              <span
                data-testid={`requirement-${key}`}
                data-met={met}
              >
                <Icon name="Check" size={16} className="text-primary" />
              </span>
            ) : (
              <span
                data-testid={`requirement-${key}`}
                data-met={met}
              >
                <Icon name="X" size={16} className="text-on-surface-variant" />
              </span>
            )}
            <span
              className={`text-xs transition-colors duration-200 ${
                met ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
