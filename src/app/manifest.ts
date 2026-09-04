import type { MetadataRoute } from "next";

const APP_ICON_VERSION = "matchuplab-v1";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MatchupLab",
    short_name: "MatchupLab",
    description: "この端末でメンバー管理と対戦表作成ができるローカルアプリです。",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8ff",
    theme_color: "#1d4ed8",
    lang: "ja",
    icons: [
      {
        src: `/icons/icon-192.png?iconv=${APP_ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/icons/icon-512.png?iconv=${APP_ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
