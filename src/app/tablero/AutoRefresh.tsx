"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Refresca el tablero para dejarlo en una pantalla de pared, pero SIN mantener la
// base de datos despierta 24/7: el polling se pausa cuando la pestaña no está
// visible (o el equipo está sin conexión). Así Neon puede dormir (scale-to-zero)
// y no se consume cómputo cuando nadie está mirando el tablero.
export function AutoRefresh({ segundos = 300 }: { segundos?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ms = Math.max(60, segundos) * 1000; // mínimo 60s para no martillar la BD

  useEffect(() => {
    const activo = () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      (typeof navigator === "undefined" || navigator.onLine !== false);

    const parar = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };

    const arrancar = () => {
      if (timer.current || !activo()) return;
      timer.current = setInterval(() => {
        if (activo()) router.refresh();
      }, ms);
    };

    // Al volver a la pestaña (o recuperar conexión): refresca al instante y reanuda.
    const onReanudar = () => {
      if (activo()) {
        router.refresh();
        arrancar();
      } else {
        parar();
      }
    };

    arrancar();
    document.addEventListener("visibilitychange", onReanudar);
    window.addEventListener("online", onReanudar);
    window.addEventListener("offline", parar);

    return () => {
      parar();
      document.removeEventListener("visibilitychange", onReanudar);
      window.removeEventListener("online", onReanudar);
      window.removeEventListener("offline", parar);
    };
  }, [router, ms]);

  return null;
}
