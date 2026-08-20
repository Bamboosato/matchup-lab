"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BRAND_LOGO_SRC } from "@/lib/constants/assets";

const SPLASH_SESSION_KEY = "matchuplab-pwa-splash-shown-v1";
const SPLASH_VISIBLE_MS = 1200;
const SPLASH_FADE_MS = 320;

function isStandalonePwa() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function hasSplashBeenShown() {
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "shown";
  } catch {
    return false;
  }
}

function markSplashShown() {
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "shown");
  } catch {
    // Storage failures should not block the splash lifecycle.
  }
}

export function PwaSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!isStandalonePwa()) {
      return;
    }

    if (hasSplashBeenShown()) {
      return;
    }

    const mountTimer = window.setTimeout(() => {
      setMounted(true);
    }, 0);

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, SPLASH_VISIBLE_MS);

    const unmountTimer = window.setTimeout(() => {
      markSplashShown();
      setMounted(false);
    }, SPLASH_VISIBLE_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      data-testid="pwa-splash-screen"
      role="status"
      aria-label="アプリを起動しています"
      className={`pwa-splash-screen${leaving ? " pwa-splash-screen-leaving" : ""}`}
    >
      <Image
        data-testid="pwa-splash-logo"
        src={BRAND_LOGO_SRC}
        alt="MatchupLab"
        width={360}
        height={360}
        priority
        unoptimized
        className="pwa-splash-logo"
      />
    </div>
  );
}
