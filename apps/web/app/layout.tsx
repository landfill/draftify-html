import type { Metadata } from "next";
import "./globals.css";
import { ThemeInitScript } from "@/components/theme-init.js";

export const metadata: Metadata = {
  title: "Mockspec",
  description: "목업을 등록하면 단독 실행 기획서 HTML을 만들어 주는 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
