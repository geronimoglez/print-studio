// Sistema de RIESGO de 2 capas (control para publicar/filtrar/pausar):
//   Capa 1 — MARCA/IP: ¿es personaje o marca registrada? (riesgo ALTO, legal duro)
//   Capa 2 — LICENCIA del archivo: ¿el creador permite venta? (riesgo BAJO, términos del creador)
//
// nivelRiesgo combina ambas:
//   🟢 verde   = IP-limpio + licencia libre (CC-BY/CC0/Comercial/Propia) → 100% limpio
//   🟡 amarillo = IP-limpio + licencia restringida (Personal/NC/Exclusive) → publicable a riesgo (capa 2)
//   🔴 rojo    = MARCA/IP (personaje o marca) → NO publicar salvo override explícito
//
// Política HÍBRIDA (decisión de negocio): se publican verde + amarillo; rojo se bloquea por default.
import { esAptoVenta } from "./licencias";

export type MarcaIp = "no" | "personaje" | "marca";
export type NivelRiesgo = "verde" | "amarillo" | "rojo";

// Personajes con IP (anime/película/juego/cómic). fan-art no licenciable comercialmente.
const RE_PERSONAJE =
  /pikachu|bulbasaur|charmander|squirtle|mew\b|ditto|eevee|pokeball|masterball|pok[eé]mon|pok[eé]\b|batman|superman|spider-?man|iron-?man|\bhulk\b|thor|venom|deadpool|groot|avenger|marvel|mickey|minnie|donald|duffy|bugs\s*bunny|tweety|piolin|scooby|looney|shrek|sonic|shadow|knuckles|stitch|disney|dobby|harry\s*potter|luffy|naruto|kakashi|sasuke|rinnegan|goku|gohan|goten|vegeta|vegito|gogeta|trunks|broly|freezer|frieza|cell\b|majin|buu|bills|beerus|piccolo|krillin|yamcha|raditz|nappa|bardock|cooler|jiren|toppo|shenron|janemba|androide?\s*\d|android\s*\d|dragon\s*ball|skeletor|he-?man|stormtrooper|star\s*wars|\bjoker\b|derpy|\bpony\b|rumi\b|zoey|\bmira\b|jinu|demon\s*hunter|saja|huntr|tapion|chichi|roshi|bulma|baba|chirai|toriyama|\bmario\b|\bluigi\b|\byoshi\b|zelda|kirby|nintendo|minecraft|creeper|among\s*us|baby\s*yoda|grogu|bluey|sanrio|kuromi|cinnamoroll|totoro|ghibli|mjoll?nir|squirtle|blastoise|charizard|gengar|snorlax|mewtwo|sharingan|seven\s*deadly|nanatsu|game\s*of\s*thrones|\bgot\b|stark|targaryen|lannister|comegalletas|cookie\s*monster|wolverine|wonder\s*woman|aquaman|gojo|jujutsu|tanjiro|nezuko|kimetsu|\bdc\b/i;

// Marcas registradas: clubes, ligas, jugadores, FIFA, empresas, y marcas/modelos de autos y motos.
const RE_MARCA =
  /\bboca\b|river\b|racing\b|san\s*lorenzo|independiente|estudiantes|hurac[aá]n|banfield|colon|chacarita|newells|tigre\b|talleres|velez|rosario\s*central|gimnasia|barcelona|real\s*madrid|atletico|juventus|\bmilan\b|inter\b|liverpool|chelsea|arsenal|manchester|\bpsg\b|bayern|dortmund|\bmessi|ronaldo|cristiano|mbapp[eé]|neymar|foden|hazard|de\s*bruyne|debruyne|ronaldinho|casillas|buffon|b\.\s*fernandez|fifa|copa\s*del\s*mundo|mundial|panini|champions|premier\s*league|laliga|\bnike\b|adidas|puma\b|acura|alfa\s*romeo|aston\s*martin|\baudi\b|\bbmw\b|bentley|bugatti|cadillac|chevrolet|citro[eë]n|\bdodge\b|ducati|ferrari|\bfiat\b|\bford\b|\bhonda\b|hyundai|jaguar|\bjeep\b|kawasaki|lamborghini|land\s*rover|lexus|maserati|mazda|mclaren|mercedes|mitsubishi|nissan|peugeot|pontiac|porsche|renault|rolls\s*royce|subaru|suzuki|tesla|toyota|volkswagen|\bvw\b|volvo|yamaha|harley|davidson|vespa|mustang|camaro|corvette|impala|\bsupra\b|skyline|hilux|wrangler|gladiator|centenario|gallardo|aventador|veyron|\blego\b|tottenham|\bnba\b|\bnfl\b|disney|coca\s*cola|stanley\b/i;

/** Clasifica el nombre del modelo en su estatus de MARCA/IP (capa 1). */
export function clasificarIp(nombre: string): MarcaIp {
  const n = nombre || "";
  if (RE_MARCA.test(n)) return "marca";
  if (RE_PERSONAJE.test(n)) return "personaje";
  return "no";
}

/** Nivel de riesgo combinado (capa 1 + capa 2). */
export function nivelRiesgo(marcaIp: string | null | undefined, licencia: string): NivelRiesgo {
  if (marcaIp && marcaIp !== "no") return "rojo";
  return esAptoVenta(licencia) ? "verde" : "amarillo";
}

/** Política híbrida: publicable si NO es rojo (marca/personaje). amarillo = a riesgo, permitido. */
export function esPublicable(marcaIp: string | null | undefined, licencia: string): boolean {
  return nivelRiesgo(marcaIp, licencia) !== "rojo";
}

export const ETIQUETA: Record<NivelRiesgo, string> = {
  verde: "🟢 100% limpio (IP + licencia)",
  amarillo: "🟡 IP-limpio · licencia del archivo restringida (riesgo capa 2)",
  rojo: "🔴 Marca/personaje IP (no publicar sin decisión explícita)",
};
