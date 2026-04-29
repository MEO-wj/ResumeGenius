import type { ParsedContent } from '@/lib/api-client'
import ParsedItem from './ParsedItem'

interface ParsedSidebarProps {
  contents: ParsedContent[]
}

export default function ParsedSidebar({ contents }: ParsedSidebarProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        解析结果
      </h2>
      <div className="flex flex-col gap-2">
        {contents.map((c) => (
          <ParsedItem key={c.asset_id} content={c} />
        ))}
      </div>
    </div>
  )
}
