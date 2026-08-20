import type { Metadata } from "next";
import { AppClientShell } from "@/app/AppClientShell";
import { PwaSplashScreen } from "@/components/pwa/PwaSplashScreen";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import "./globals.css";

const MATCHUPLAB_ICON_SRC = "/matchuplab-icon.png";

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
        url: MATCHUPLAB_ICON_SRC,
        type: "image/png",
      },
    ],
    apple: [
      {
        url: MATCHUPLAB_ICON_SRC,
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <PwaSplashScreen />
        <AppClientShell>{children}</AppClientShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
