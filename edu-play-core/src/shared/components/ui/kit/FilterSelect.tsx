'use client';

import { useId, type ReactNode } from 'react';
import {
  Box,
  type BoxProps,
  Combobox,
  createVarsResolver,
  type ElementProps,
  factory,
  type Factory,
  getFontSize,
  getRadius,
  getSpacing,
  InputBase,
  type MantineRadius,
  type MantineSize,
  type MantineSpacing,
  rem,
  type StylesApiProps,
  useCombobox,
  useProps,
  useStyles,
} from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import classes from './FilterSelect.module.css';

export interface FilterSelectOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export type FilterSelectStylesNames =
  | 'root'
  | 'label'
  | 'input'
  | 'value'
  | 'dropdown'
  | 'option'
  | 'optionLabel'
  | 'description';

export type FilterSelectCssVariables = {
  root:
    | '--filter-select-gap'
    | '--filter-select-radius'
    | '--filter-select-font-size'
    | '--filter-select-height'
    | '--filter-select-width';
};

export interface FilterSelectProps
  extends BoxProps,
    StylesApiProps<FilterSelectFactory>,
    ElementProps<'div', 'onChange'> {
  options: FilterSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  ariaLabel?: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  emptyLabel?: ReactNode;
  size?: MantineSize;
  radius?: MantineRadius;
  gap?: MantineSpacing;
  width?: number | string;
  fullWidth?: boolean;
  icon?: IconName;
  inputId?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
}

export type FilterSelectFactory = Factory<{
  props: FilterSelectProps;
  ref: HTMLDivElement;
  stylesNames: FilterSelectStylesNames;
  vars: FilterSelectCssVariables;
}>;

const SELECT_SIZES: Record<MantineSize, { height: string; width: string }> = {
  xs: { height: rem(44), width: rem(132) },
  sm: { height: rem(44), width: rem(148) },
  md: { height: rem(44), width: rem(168) },
  lg: { height: rem(48), width: rem(188) },
  xl: { height: rem(52), width: rem(208) },
};

const defaultProps = {
  size: 'md',
  radius: 'xl',
  gap: 'xs',
  placeholder: 'Selectează',
  emptyLabel: 'Nu există opțiuni',
} satisfies Partial<FilterSelectProps>;

const varsResolver = createVarsResolver<FilterSelectFactory>(
  (_theme, { gap, radius, size, width }) => {
    const selectSize = SELECT_SIZES[size ?? defaultProps.size];
    const resolvedWidth =
      typeof width === 'number' ? rem(width) : width ?? selectSize.width;

    return {
      root: {
        '--filter-select-gap': getSpacing(gap),
        '--filter-select-radius': getRadius(radius),
        '--filter-select-font-size': getFontSize(size),
        '--filter-select-height': selectSize.height,
        '--filter-select-width': resolvedWidth,
      },
    };
  },
);

export const FilterSelect = factory<FilterSelectFactory>((_props) => {
  const props = useProps('FilterSelect', defaultProps, _props);
  const {
    ref,
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    options,
    value,
    onChange,
    label,
    ariaLabel,
    placeholder,
    disabled,
    emptyLabel,
    size,
    radius,
    gap: _gap,
    width: _width,
    fullWidth,
    icon,
    inputId,
    ariaDescribedBy,
    invalid,
    ...others
  } = props;

  const labelId = useId();
  const ariaLabelId = useId();
  const valueId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.selectFirstOption(),
  });

  const getStyles = useStyles<FilterSelectFactory>({
    name: 'FilterSelect',
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    attributes,
    varsResolver,
  });

  const handleOptionSubmit = (nextValue: string) => {
    const nextOption = options.find((option) => option.value === nextValue);
    if (!nextOption || nextOption.disabled) return;

    onChange(nextValue);
    combobox.closeDropdown();
  };

  return (
    <Box
      ref={ref}
      {...getStyles('root')}
      data-full-width={fullWidth || undefined}
      {...others}
    >
      {label ? (
        <Box component="span" id={labelId} {...getStyles('label')}>
          {label}
        </Box>
      ) : null}

      {!label && ariaLabel ? (
        <span id={ariaLabelId} hidden>
          {ariaLabel}
        </span>
      ) : null}

      <Combobox
        store={combobox}
        onOptionSubmit={handleOptionSubmit}
        size={size}
        radius={radius}
        withinPortal={false}
      >
        <Combobox.Target targetType="button">
          <InputBase
            id={inputId}
            component="button"
            type="button"
            pointer
            disabled={disabled}
            // Name = label + visible value, so the accessible name always contains the visible text (WCAG 2.5.3).
            aria-labelledby={label ? `${labelId} ${valueId}` : ariaLabel ? `${ariaLabelId} ${valueId}` : undefined}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            data-invalid={invalid || undefined}
            leftSection={icon ? <Icon name={icon} size="sm" aria-hidden /> : undefined}
            rightSection={<Combobox.Chevron />}
            onClick={() => combobox.toggleDropdown()}
            {...getStyles('input')}
          >
            <span
              id={valueId}
              {...getStyles('value')}
              data-placeholder={selectedOption ? undefined : true}
            >
              {selectedOption?.label ?? placeholder}
            </span>
          </InputBase>
        </Combobox.Target>

        <Combobox.Dropdown {...getStyles('dropdown')}>
          <Combobox.Options>
            {options.length === 0 ? (
              <Combobox.Empty>{emptyLabel}</Combobox.Empty>
            ) : (
              options.map((option) => (
                <Combobox.Option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  selected={option.value === value}
                  data-selected={option.value === value || undefined}
                  {...getStyles('option')}
                >
                  <span {...getStyles('optionLabel')}>{option.label}</span>
                  {option.description ? (
                    <span {...getStyles('description')}>{option.description}</span>
                  ) : null}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Box>
  );
});

FilterSelect.displayName = '@mantine/core/FilterSelect';
FilterSelect.classes = classes;
FilterSelect.varsResolver = varsResolver;
