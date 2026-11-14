'use client';

import { MantineContext, MantineProvider, UnstyledButton } from '@mantine/core';
import { useContext, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface GameChromeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function GameChromeButton({ children, type = 'button', ...props }: GameChromeButtonProps) {
  const mantineContext = useContext(MantineContext);
  const button = (
    <UnstyledButton type={type} {...props}>
      {children}
    </UnstyledButton>
  );

  return mantineContext ? button : <MantineProvider>{button}</MantineProvider>;
}
