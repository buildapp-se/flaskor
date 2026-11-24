import { useCallback, useRef, useState } from 'react'

// Vyinställningar som ska överleva sidbyte och omladdning (sök, chips, sortering, kolumner) sparas i localStorage.
// ponytail: inte i adressen, hash-routingen har inga sökparametrar och ingen behöver länka till ett filter.
export function usePersisted<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      // Sparat värde ovanpå standard, så nya fält får sitt standardvärde när koden växer.
      return raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial
    } catch {
      return initial
    }
  })
  // Senaste värdet utanför React, så skrivningen sker direkt och inte i en uppdatering som aldrig körs om
  // komponenten avmonteras samma tick (Importera tömmer utkastet och navigerar bort, UX-audit 2026-11-24).
  const latest = useRef(value)
  const update = useCallback(
    (patch: Partial<T>) => {
      const next = { ...latest.current, ...patch }
      latest.current = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* bekvämlighet, inte ett krav */
      }
      setValue(next)
    },
    [key],
  )
  return [value, update]
}
