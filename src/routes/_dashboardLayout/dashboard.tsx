import { createFileRoute } from '@tanstack/react-router'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Activity,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_dashboardLayout/dashboard')({
  component: Dashboard,
})

const stats = [
  {
    title: '总销售额',
    value: '¥45,231',
    change: '+20.1%',
    icon: DollarSign,
    trend: 'up',
  },
  {
    title: '订阅数',
    value: '2,350',
    change: '+180.1%',
    icon: Users,
    trend: 'up',
  },
  {
    title: '销售额',
    value: '¥12,234',
    change: '+19%',
    icon: TrendingUp,
    trend: 'up',
  },
  {
    title: '活跃用户',
    value: '573',
    change: '+201',
    icon: Activity,
    trend: 'up',
  },
]

function Dashboard() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                  {stat.change}
                </span>{' '}
                与上月相比
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>概览</CardTitle>
            <CardDescription>
              过去 12 个月的数据概览
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>图表区域</p>
                <p className="text-sm">可以在这里添加图表组件</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>您的最新操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      活动 {i}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      这是活动描述
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">2小时前</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
