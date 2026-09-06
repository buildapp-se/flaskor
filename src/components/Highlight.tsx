import type { ReactNode } from 'react'

/** Texten med varje träff på sökordet i <mark>, så det syns varför raden kom med. Tom sökning ger texten orörd. */
export function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  if (query === '') return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(query, from); at !== -1; at = lower.indexOf(query, from)) {
    parts.push(text.slice(from, at), <mark key={at}>{text.slice(at, at + query.length)}</mark>)
    from = at + query.length
  }
  parts.push(text.slice(from))
  return parts
}

/** Sant när sökordet träffar just det här fältet, för att visa fältet i raden. */
export function hits(field: string | null, query: string): field is string {
  return query !== '' && field !== null && field.toLowerCase().includes(query)
}
