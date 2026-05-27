import type { Metadata } from "next";
import "./globals.css";
import { LocatorDevRuntime } from "./locator-dev-runtime";

export const metadata: Metadata = {
  title: "Цифровой журнал по технике безопасности",
  description: "Цифровой журнал инструктажей и контроля требований охраны труда.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showLocatorRuntime =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_LOCATOR === "1";

  return (
    <html lang="ru">
      <body className="font-[family-name:var(--font-sans)] antialiased">
        {children}
        {showLocatorRuntime ? <LocatorDevRuntime /> : null}
      </body>
    </html>
  );
}
