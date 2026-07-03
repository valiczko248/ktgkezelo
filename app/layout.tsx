import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const body = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Költségkövető",
  description: "Személyes pénzügyeid átlátható, biztonságos nyomon követése",
  manifest: "/manifest.json",
};

// Az egész alkalmazás bejelentkezéshez kötött, felhasználó-specifikus adatot mutat,
// ezért soha nem szabad build-időben előre legenerálni — mindig kérés-időben töltődjön be.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0A84FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Villanás elkerülése: a mentett téma beállítás azonnali alkalmazása betöltéskor
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="mesh-bg" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {children}
      </body>
    </html>
  );
}
