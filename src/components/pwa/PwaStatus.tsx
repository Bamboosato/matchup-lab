"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SERVICE_WORKER_REGISTERED_EVENT = "matchuplab:sw-registered";

type ServiceWorkerRegisteredDetail = {
  registration: ServiceWorkerRegistration;
};

function subscribeToOnlineStatus(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

export function PwaStatus() {
  const [isMounted, setIsMounted] = useState(false);
  const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus, getServerOnlineStatus);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setIsMounted(true), 0);

    return () => window.clearTimeout(mountedTimer);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      if (isUpdatingRef.current) {
        window.location.reload();
      }
    };

    let activeRegistration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;

    const handleInstallingStateChange = () => {
      if (installingWorker?.state === "installed" && navigator.serviceWorker.controller) {
        setHasUpdate(true);
      }
    };

    const attachRegistration = (registration: ServiceWorkerRegistration) => {
      activeRegistration = registration;
      registrationRef.current = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        setHasUpdate(true);
      }

      installingWorker?.removeEventListener("statechange", handleInstallingStateChange);
      installingWorker = registration.installing;
      installingWorker?.addEventListener("statechange", handleInstallingStateChange);
      registration.addEventListener("updatefound", handleUpdateFound);
    };

    function handleUpdateFound() {
      if (!activeRegistration) {
        return;
      }

      installingWorker?.removeEventListener("statechange", handleInstallingStateChange);
      installingWorker = activeRegistration.installing;
      installingWorker?.addEventListener("statechange", handleInstallingStateChange);
    }

    const handleServiceWorkerRegistered = (event: Event) => {
      const detail = (event as CustomEvent<ServiceWorkerRegisteredDetail>).detail;
      if (detail?.registration) {
        attachRegistration(detail.registration);
      }
    };

    window.addEventListener(SERVICE_WORKER_REGISTERED_EVENT, handleServiceWorkerRegistered);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        attachRegistration(registration);
      }
    });

    return () => {
      installingWorker?.removeEventListener("statechange", handleInstallingStateChange);
      activeRegistration?.removeEventListener("updatefound", handleUpdateFound);
      window.removeEventListener(SERVICE_WORKER_REGISTERED_EVENT, handleServiceWorkerRegistered);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  async function applyUpdate() {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) {
      setHasUpdate(false);
      setUpdateError(true);
      return;
    }

    setUpdateError(false);
    setHasUpdate(false);
    setIsUpdating(true);
    isUpdatingRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!isMounted) {
    return null;
  }

  if (isUpdating) {
    return (
      <div className="pwa-status pwa-status-info" role="status" aria-live="polite">
        <span>更新しています。</span>
      </div>
    );
  }

  if (updateError) {
    return (
      <div className="pwa-status pwa-status-error" role="alert" aria-live="assertive">
        <span>更新できませんでした。再試行してください。</span>
        <button className="pwa-status-action" type="button" onClick={() => void applyUpdate()}>
          再試行
        </button>
      </div>
    );
  }

  if (hasUpdate) {
    return (
      <div className="pwa-status pwa-status-update" role="status" aria-live="polite">
        <span>新しいバージョンがあります。</span>
        <span className="pwa-status-actions">
          <button className="pwa-status-action" type="button" onClick={() => void applyUpdate()}>
            更新
          </button>
          <button className="pwa-status-action pwa-status-action-muted" type="button" onClick={() => setHasUpdate(false)}>
            後で
          </button>
        </span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="pwa-status pwa-status-offline" role="status" aria-live="polite">
        オフラインで利用中
      </div>
    );
  }

  return null;
}
