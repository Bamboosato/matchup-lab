import type { Metadata } from "next";
import { AppClientShell } from "@/app/AppClientShell";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { APP_FAVICON_SRC } from "@/lib/constants/assets";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchupLab",
  description: "この端末でメンバー管理と対戦表作成ができるローカルアプリ",
  applicationName: "MatchupLab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MatchupLab",
  },
  icons: {
    icon: [
      {
        url: APP_FAVICON_SRC,
        type: "image/png",
      },
    ],
    apple: [
      {
        url: APP_FAVICON_SRC,
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <AppClientShell>{children}</AppClientShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
