import { useCallback, useState } from 'react'

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
  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((prev) => {
        const next = { ...prev, ...patch }
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* bekvämlighet, inte ett krav */
        }
        return next
      })
    },
    [key],
  )
  return [value, update]
}
