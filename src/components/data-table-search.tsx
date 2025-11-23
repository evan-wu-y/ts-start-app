import { Table } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DataTableSearchProps<TData> {
  table: Table<TData>
  filterColumn?: string
  placeholder?: string
  className?: string
}

export function DataTableSearch<TData>({
  table,
  filterColumn,
  placeholder,
  className,
}: DataTableSearchProps<TData>) {
  // 根据是否指定列来决定使用哪种过滤方式
  const filterValue = filterColumn
    ? ((table.getColumn(filterColumn)?.getFilterValue() as string) ?? '')
    : ((table.getState().globalFilter as string) ?? '')

  // 动态生成 placeholder
  const dynamicPlaceholder =
    placeholder || (filterColumn ? `搜索 ${filterColumn} 列...` : '搜索...')

  const handleChange = (value: string) => {
    if (filterColumn) {
      // 列搜索
      table.getColumn(filterColumn)?.setFilterValue(value || undefined)
    } else {
      // 全局搜索（默认）
      table.setGlobalFilter(value || undefined)
    }
  }

  return (
    <Input
      placeholder={dynamicPlaceholder}
      value={filterValue}
      onChange={(event) => handleChange(event.target.value)}
      className={cn('max-w-sm', className)}
    />
  )
}
