'use client'

interface QuestPathProps {
  rows: number
  rowGap?: number
  topPadding?: number
}

export function QuestPath({
  rows,
  rowGap = 110,
  topPadding = 50,
}: QuestPathProps) {
  if (rows < 2) {
    return null
  }

  const leftX = 180
  const rightX = 480
  const innerLeftX = 200

  const segments: string[] = [`M ${leftX} ${topPadding}`]

  for (let index = 1; index < rows; index += 1) {
    const controlY = topPadding + rowGap * (index - 0.5)
    const endY = topPadding + rowGap * index
    segments.push(`Q ${rightX} ${controlY} ${innerLeftX} ${endY}`)
  }

  const totalHeight = topPadding + rowGap * (rows - 1) + 80

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height={totalHeight}
      viewBox={`0 0 660 ${totalHeight}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0"
    >
      <path
        d={segments.join(' ')}
        stroke="var(--color-outline)"
        strokeWidth={8}
        strokeDasharray="4 16"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
