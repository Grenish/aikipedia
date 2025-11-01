import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/kibo-ui/theme-switcher";

const inter = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: "normal",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AikiPedia",
  description:
    "Your AI-glorified Wikipedia that roasts the same boring facts you'd scroll past on the real one-but now with zero patience for the dry-ass nonsense.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="1b0e2e9f-49bd-428a-88cb-e57e5040c2c8"
        ></script>
      </head>
      <body className={`${inter.className} antialiased relative`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeSwitcher className="fixed top-3 right-4 sm:right-6 md:right-8 lg:right-10 z-50" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
