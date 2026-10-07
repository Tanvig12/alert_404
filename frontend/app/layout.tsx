import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOC Sentinel AI — Autonomous Security Operations Center",
  description: "High-density real-time AI security operations console with 3D attack topology and human-in-the-loop triage.",
};

export const viewport: Viewport = {
  themeColor: "#070a0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${ibmPlexSans.variable} dark`}
    >
      <body className="film-grain min-h-[100dvh] bg-[var(--soc-bg)] text-[var(--soc-ink)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
