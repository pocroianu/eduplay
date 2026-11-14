'use client';

import {
  Children,
  forwardRef,
  isValidElement,
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';
import { FilterSelect, type FilterSelectOption } from './FilterSelect';

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'size'> {
  label: string;
  icon?: IconName;
  error?: string;
  helper?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
}

type OptionChildProps = {
  value?: string | number;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
};

function optionChildrenToItems(children: ReactNode): FilterSelectOption[] {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((child, index) => {
      const option = child as ReactElement<OptionChildProps>;
      const rawValue = option.props.value ?? option.props.children ?? index;

      return {
        value: String(rawValue),
        label: option.props.label ?? option.props.children,
        disabled: option.props.disabled,
      };
    });
}

/** Standard-mode select field matching the Seesaw-style `TextField` anatomy. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      icon,
      error,
      helper,
      id,
      required,
      className,
      disabled,
      children,
      value,
      defaultValue,
      name,
      onChange,
      onBlur,
      ..._rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const describedBy = error ? errorId : helper ? helperId : undefined;
    const options = optionChildrenToItems(children);
    const controlledValue = value === undefined ? undefined : String(value);
    const [uncontrolledValue, setUncontrolledValue] = useState(
      String(defaultValue ?? options[0]?.value ?? ''),
    );
    const selectedValue = controlledValue ?? uncontrolledValue;

    const handleChange = (nextValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }

      onChange?.({
        target: { name, value: nextValue },
        currentTarget: { name, value: nextValue },
      } as ChangeEvent<HTMLSelectElement>);
    };

    const handleBlur = () => {
      onBlur?.({
        target: { name, value: selectedValue },
        currentTarget: { name, value: selectedValue },
      } as FocusEvent<HTMLSelectElement>);
    };

    return (
      <div className={cn('space-y-2', className)}>
        <FilterSelect
          label={
            <>
              {label}
              {required && (
                <span aria-hidden="true" className="ml-0.5 text-primary">
                  *
                </span>
              )}
            </>
          }
          inputId={selectId}
          icon={icon}
          value={selectedValue}
          onChange={handleChange}
          options={options}
          disabled={disabled}
          invalid={Boolean(error)}
          ariaDescribedBy={describedBy}
          fullWidth
          radius="md"
          width="100%"
          onBlur={handleBlur}
        />
        <input
          ref={ref as never}
          type="hidden"
          name={name}
          value={selectedValue}
          disabled={disabled}
          readOnly
        />

        {error ? (
          <p id={errorId} role="alert" className="ml-1 flex items-center gap-1.5 text-sm text-error">
            <Icon name="XCircle" size={14} weight="fill" aria-hidden className="shrink-0" />
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="ml-1 text-sm text-on-surface-variant">
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);

SelectField.displayName = 'SelectField';
