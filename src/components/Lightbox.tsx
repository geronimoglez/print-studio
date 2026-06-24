"use client";

import { useState } from "react";

// Miniatura con lupa: clic abre la foto en grande (modal). Clic afuera la cierra.
export function FotoThumb({ url, className = "h-20 w-20" }: { url: string; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="block" title="Ver en grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className={`${className} cursor-zoom-in rounded-md border border-slate-200 object-cover`}
        />
      </button>
      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </>
  );
}
