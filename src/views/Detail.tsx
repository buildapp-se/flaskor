import { S } from '../strings.ts'

// Stubb tills vyn byggs i sin egen commit.
export function Detail({ id }: { id: number }) {
  return (
    <h1 className="fl-display">
      {S.detail.notFound} {id}
    </h1>
  )
}
