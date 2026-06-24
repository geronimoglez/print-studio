"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca el tablero solo, para dejarlo en una pantalla de pared.
export function AutoRefresh({ segundos = 45 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
