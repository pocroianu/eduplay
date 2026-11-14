import type { Metadata } from "next";
import { lexend, mono } from "./fonts";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getServerLanguage, preloadNamespaces } from "@/lib/i18n/server";
import { eduPlayMantineTheme } from "@/shared/theme";

import '@mantine/core/styles.css';
import { MantineProvider, mantineHtmlProps } from '@mantine/core';

export const metadata: Metadata = {
  title: "EduPlay România - Platformă de învățare pentru copii",
  description: "Platformă educațională interactivă pentru copii din România, cu jocuri și activități de învățare pentru vârste 3-12 ani.",
  keywords: ["educație", "copii", "jocuri educaționale", "România", "învățare", "preșcolari"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getServerLanguage();
  const resources = await preloadNamespaces(lang, ["common"]);

  return (
    <html lang={lang} className={`${lexend.variable} ${mono.variable}`} {...mantineHtmlProps}>
      <body className="antialiased">
        <MantineProvider theme={eduPlayMantineTheme}>
          <I18nProvider lang={lang} resources={resources}>
            {children}
          </I18nProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
