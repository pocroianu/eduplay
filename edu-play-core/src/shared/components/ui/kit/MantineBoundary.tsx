"use client";

import { MantineContext, MantineProvider } from "@mantine/core";
import { useContext, type ReactNode } from "react";
import { eduPlayMantineTheme } from "@/shared/theme";

/** Reuse the app provider; retain the EduPlay theme in standalone embeds. */
export function MantineBoundary({ children }: { children: ReactNode }) {
  const context = useContext(MantineContext);
  return context ? (
    children
  ) : (
    <MantineProvider theme={eduPlayMantineTheme}>{children}</MantineProvider>
  );
}
