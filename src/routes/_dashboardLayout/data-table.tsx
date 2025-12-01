import { createFileRoute } from '@tanstack/react-router'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/_dashboardLayout/data-table')({
  component: DataTablePage,
})

// 数据类型定义
export type Payment = {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'success' | 'failed'
  email: string
  name: string
}

// 示例数据
const data: Payment[] = [
  {
    id: 'm5gr84i9',
    amount: 316,
    status: 'success',
    email: 'ken99@example.com',
    name: '张三',
  },
  {
    id: '3u1reuv4',
    amount: 242,
    status: 'success',
    email: 'Abe45@example.com',
    name: '李四',
  },
  {
    id: 'derv1ws0',
    amount: 837,
    status: 'processing',
    email: 'Monserrat44@example.com',
    name: '王五',
  },
  {
    id: '5kma53ae',
    amount: 874,
    status: 'success',
    email: 'Silas22@example.com',
    name: '赵六',
  },
  {
    id: 'bhqecj4p',
    amount: 721,
    status: 'failed',
    email: 'carmella@example.com',
    name: '钱七',
  },
  {
    id: '8kma53ae',
    amount: 450,
    status: 'pending',
    email: 'test@example.com',
    name: '孙八',
  },
  {
    id: '9kma53ae',
    amount: 1200,
    status: 'success',
    email: 'demo@example.com',
    name: '周九',
  },
  {
    id: '0kma53ae',
    amount: 680,
    status: 'processing',
    email: 'sample@example.com',
    name: '吴十',
  },
  {
    id: 'a1b2c3d4',
    amount: 1560,
    status: 'success',
    email: 'zhangwei@example.com',
    name: '张伟',
  },
  {
    id: 'e5f6g7h8',
    amount: 890,
    status: 'processing',
    email: 'wangfang@example.com',
    name: '王芳',
  },
  {
    id: 'i9j0k1l2',
    amount: 234,
    status: 'pending',
    email: 'liuming@example.com',
    name: '刘明',
  },
  {
    id: 'm3n4o5p6',
    amount: 1890,
    status: 'success',
    email: 'chenli@example.com',
    name: '陈丽',
  },
  {
    id: 'q7r8s9t0',
    amount: 567,
    status: 'failed',
    email: 'yangjun@example.com',
    name: '杨军',
  },
  {
    id: 'u1v2w3x4',
    amount: 1234,
    status: 'success',
    email: 'huangmei@example.com',
    name: '黄梅',
  },
  {
    id: 'y5z6a7b8',
    amount: 345,
    status: 'processing',
    email: 'xukai@example.com',
    name: '徐凯',
  },
  {
    id: 'c9d0e1f2',
    amount: 987,
    status: 'pending',
    email: 'sunli@example.com',
    name: '孙莉',
  },
  {
    id: 'g3h4i5j6',
    amount: 2100,
    status: 'success',
    email: 'mawei@example.com',
    name: '马伟',
  },
  {
    id: 'k7l8m9n0',
    amount: 456,
    status: 'failed',
    email: 'zhaoyan@example.com',
    name: '赵燕',
  },
  {
    id: 'o1p2q3r4',
    amount: 1789,
    status: 'success',
    email: 'zhoujie@example.com',
    name: '周杰',
  },
  {
    id: 's5t6u7v8',
    amount: 678,
    status: 'processing',
    email: 'wuxia@example.com',
    name: '吴霞',
  },
  {
    id: 'w9x0y1z2',
    amount: 3456,
    status: 'success',
    email: 'zhengtao@example.com',
    name: '郑涛',
  },
  {
    id: 'a3b4c5d6',
    amount: 789,
    status: 'pending',
    email: 'fengjing@example.com',
    name: '冯静',
  },
  {
    id: 'e7f8g9h0',
    amount: 1456,
    status: 'success',
    email: 'caoyu@example.com',
    name: '曹宇',
  },
  {
    id: 'i1j2k3l4',
    amount: 234,
    status: 'failed',
    email: 'hanlei@example.com',
    name: '韩磊',
  },
  {
    id: 'm5n6o7p8',
    amount: 2678,
    status: 'success',
    email: 'tangxin@example.com',
    name: '唐欣',
  },
  {
    id: 'q9r0s1t2',
    amount: 890,
    status: 'processing',
    email: 'dengbin@example.com',
    name: '邓斌',
  },
  {
    id: 'u3v4w5x6',
    amount: 123,
    status: 'pending',
    email: 'gaoyan@example.com',
    name: '高艳',
  },
  {
    id: 'y7z8a9b0',
    amount: 3456,
    status: 'success',
    email: 'linhao@example.com',
    name: '林浩',
  },
  {
    id: 'c1d2e3f4',
    amount: 567,
    status: 'processing',
    email: 'heping@example.com',
    name: '何平',
  },
  {
    id: 'g5h6i7j8',
    amount: 1890,
    status: 'success',
    email: 'luoyi@example.com',
    name: '罗艺',
  },
  {
    id: 'k9l0m1n2',
    amount: 456,
    status: 'failed',
    email: 'songyang@example.com',
    name: '宋阳',
  },
  {
    id: 'o3p4q5r6',
    amount: 2345,
    status: 'success',
    email: 'panlei@example.com',
    name: '潘磊',
  },
  {
    id: 's7t8u9v0',
    amount: 678,
    status: 'pending',
    email: 'fangmin@example.com',
    name: '方敏',
  },
  {
    id: 'w1x2y3z4',
    amount: 1567,
    status: 'success',
    email: 'renqiang@example.com',
    name: '任强',
  },
  {
    id: 'a5b6c7d8',
    amount: 890,
    status: 'processing',
    email: 'shixue@example.com',
    name: '石雪',
  },
]

// 状态标签映射
const statusLabels: Record<Payment['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
}

// 状态样式映射
const statusStyles: Record<Payment['status'], string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

// 列定义
export const columns: ColumnDef<Payment>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="选择全部"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="选择行"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          姓名
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div>{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          邮箱
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="lowercase">{row.getValue('email')}</div>,
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ row }) => {
      const status = row.getValue('status') as Payment['status']
      return (
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </div>
      )
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">金额</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'))

      // 格式化为货币格式
      const formatted = new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
      }).format(amount)

      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const payment = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(payment.id)}
            >
              复制支付 ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>查看客户</DropdownMenuItem>
            <DropdownMenuItem>查看支付详情</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

function DataTablePage() {
  return (
    <div className="flex flex-1 flex-col p-2 md:p-4 w-full">
      <div className="flex flex-col gap-2 min-w-0 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">数据表格</h1>
        <p className="text-sm text-muted-foreground">
          基于 shadcn/ui 和 TanStack Table 实现的强大数据表格组件
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>支付记录</CardTitle>
          <CardDescription>
            这是一个功能完整的数据表格示例，支持排序、筛选、分页和列显示控制
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          <DataTable columns={columns} filterColumn="email" data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
