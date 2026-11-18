import { JetBrains_Mono, Lexend } from "next/font/google";

export const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});


export const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  display: "swap",
});
