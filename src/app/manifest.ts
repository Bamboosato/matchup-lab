import type { MetadataRoute } from "next";

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
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
