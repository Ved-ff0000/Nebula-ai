import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/hooks/useTheme";

export const metadata: Metadata = {
  title: "NEBULA — AI browser agent",
  description:
    "NEBULA is a security-first universal AI browser agent: give it a goal, it plans and operates " +
    "the browser, and you stay the final authority for consequential actions.",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
            '<circle cx="24" cy="24" r="10" fill="#8a72ff"/>' +
            '<ellipse cx="24" cy="24" rx="19" ry="7.5" stroke="#22d3ee" stroke-width="2" fill="none" transform="rotate(-24 24 24)"/>' +
            "</svg>",
          ),
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
