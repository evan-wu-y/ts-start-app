import { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'

interface TablePreviewProps {
  data: Record<string, string>[]
  scrollAreaClassName?: string
}

export function TablePreview({ data, scrollAreaClassName }: TablePreviewProps) {
  // 根据 JSON 数据自动生成列定义
  const columns = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    if (data.length === 0) {
      return []
    }

    // 获取所有对象的键作为列
    const keys = Object.keys(data[0])

    return keys.map((key) => ({
      accessorKey: key,
      header: key,
      cell: ({ row }) => {
        const value = row.original[key]
        return <div className="max-w-[200px] truncate">{value || ''}</div>
      },
    }))
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        暂无数据预览
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      scrollAreaClassName={scrollAreaClassName}
    />
  )
}
