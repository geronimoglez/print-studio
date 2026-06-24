// Logo de la instancia (white-label). Si hay `logoUrl` muestra la imagen; si no, un monograma
// neutro generado a partir de las iniciales del nombre. Sin acoplar ninguna marca al código.
import Image from "next/image";
import { iniciales } from "@/lib/iniciales";

export function Logo({
  className = "",
  name = "Taller 3D",
  logoUrl = "",
}: {
  className?: string;
  name?: string;
  logoUrl?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={38}
          height={38}
          priority
          unoptimized
          className="h-9 w-9 rounded-full bg-white object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-sm font-bold tracking-tight text-brand-dark"
        >
          {iniciales(name)}
        </span>
      )}
      <span className="hidden font-semibold leading-none tracking-tight sm:inline">{name}</span>
    </span>
  );
}
