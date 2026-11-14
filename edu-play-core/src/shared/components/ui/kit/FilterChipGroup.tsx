'use client';

import type { ReactNode } from 'react';
import {
  Box,
  type BoxProps,
  createVarsResolver,
  type ElementProps,
  factory,
  type Factory,
  getFontSize,
  getRadius,
  getSpacing,
  type MantineRadius,
  type MantineSize,
  type MantineSpacing,
  rem,
  type StylesApiProps,
  UnstyledButton,
  useProps,
  useStyles,
} from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import classes from './FilterChipGroup.module.css';

export interface FilterChipOption {
  value: string;
  label: ReactNode;
  ariaLabel?: string;
  count?: number;
  icon?: IconName;
  disabled?: boolean;
}

export type FilterChipGroupItem = FilterChipOption;

export type FilterChipGroupStylesNames = 'root' | 'chip' | 'icon' | 'label' | 'count';

export type FilterChipGroupSize = MantineSize | 'kid';

export type FilterChipGroupCssVariables = {
  root:
    | '--filter-chip-gap'
    | '--filter-chip-radius'
    | '--filter-chip-font-size'
    | '--filter-chip-height'
    | '--filter-chip-padding-x'
    | '--filter-chip-padding-y';
};

export interface FilterChipGroupProps
  extends BoxProps,
    StylesApiProps<FilterChipGroupFactory>,
    ElementProps<'div', 'onChange'> {
  items: FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  allowDeselect?: boolean;
  size?: FilterChipGroupSize;
  radius?: MantineRadius;
  gap?: MantineSpacing;
  wrap?: boolean;
}

export type FilterChipGroupFactory = Factory<{
  props: FilterChipGroupProps;
  ref: HTMLDivElement;
  stylesNames: FilterChipGroupStylesNames;
  vars: FilterChipGroupCssVariables;
}>;

const CHIP_SIZES: Record<
  FilterChipGroupSize,
  { height: string; paddingX: string; paddingY: string }
> = {
  xs: { height: rem(44), paddingX: rem(10), paddingY: rem(5) },
  sm: { height: rem(44), paddingX: rem(12), paddingY: rem(6) },
  md: { height: rem(44), paddingX: rem(14), paddingY: rem(8) },
  lg: { height: rem(48), paddingX: rem(16), paddingY: rem(9) },
  xl: { height: rem(52), paddingX: rem(18), paddingY: rem(10) },
  kid: { height: rem(64), paddingX: rem(24), paddingY: rem(12) },
};

const defaultProps = {
  size: 'sm',
  radius: 'xl',
  gap: 'xs',
  wrap: true,
} satisfies Partial<FilterChipGroupProps>;

const varsResolver = createVarsResolver<FilterChipGroupFactory>(
  (_theme, { gap, radius, size }) => {
    const resolvedSize = size ?? defaultProps.size;
    const chipSize = CHIP_SIZES[resolvedSize];
    const fontSize = resolvedSize === 'kid' ? getFontSize('md') : getFontSize(resolvedSize);

    return {
      root: {
        '--filter-chip-gap': getSpacing(gap),
        '--filter-chip-radius': getRadius(radius),
        '--filter-chip-font-size': fontSize,
        '--filter-chip-height': chipSize.height,
        '--filter-chip-padding-x': chipSize.paddingX,
        '--filter-chip-padding-y': chipSize.paddingY,
      },
    };
  },
);

export const FilterChipGroup = factory<FilterChipGroupFactory>((_props) => {
  const props = useProps('FilterChipGroup', defaultProps, _props);
  const {
    ref,
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    items,
    value,
    onChange,
    ariaLabel,
    allowDeselect,
    size: _size,
    radius: _radius,
    gap: _gap,
    wrap,
    ...others
  } = props;

  const getStyles = useStyles<FilterChipGroupFactory>({
    name: 'FilterChipGroup',
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

  return (
    <Box
      ref={ref}
      {...getStyles('root')}
      role="group"
      aria-label={ariaLabel}
      data-wrap={wrap ? 'true' : 'false'}
      {...others}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <UnstyledButton
            key={item.value}
            type="button"
            aria-label={item.ariaLabel}
            aria-pressed={active}
            disabled={item.disabled}
            data-active={active || undefined}
            {...getStyles('chip')}
            onClick={() => {
              if (!item.disabled) {
                onChange(active && allowDeselect ? '' : item.value);
              }
            }}
          >
            {item.icon ? (
              <span {...getStyles('icon')} aria-hidden="true">
                <Icon name={item.icon} size="sm" />
              </span>
            ) : null}
            <span {...getStyles('label')}>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span {...getStyles('count')} aria-hidden="true">
                {item.count}
              </span>
            ) : null}
          </UnstyledButton>
        );
      })}
    </Box>
  );
});

FilterChipGroup.displayName = '@mantine/core/FilterChipGroup';
FilterChipGroup.classes = classes;
FilterChipGroup.varsResolver = varsResolver;
