import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Zap, Database } from 'lucide-react'

export const Route = createFileRoute('/_dashboardLayout/demo/ssr/')({
  component: SSRDemoIndex,
})

function SSRDemoIndex() {
  const demos = [
    {
      title: 'SPA Mode',
      description: '客户端渲染模式，数据在客户端获取',
      path: '/demo/ssr/spa-mode',
      icon: Sparkles,
      color: 'text-green-500',
    },
    {
      title: 'Full SSR',
      description: '完整的服务器端渲染，包括 HTML 和数据',
      path: '/demo/ssr/full-ssr',
      icon: Zap,
      color: 'text-purple-500',
    },
    {
      title: 'Data Only',
      description: '仅数据在服务器端获取，HTML 在客户端渲染',
      path: '/demo/ssr/data-only',
      icon: Database,
      color: 'text-pink-500',
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl">SSR 演示</CardTitle>
          <CardDescription>
            探索 TanStack Start 的不同服务器端渲染模式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {demos.map((demo) => (
              <Card key={demo.path} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <demo.icon className={`h-5 w-5 ${demo.color}`} />
                    <CardTitle>{demo.title}</CardTitle>
                  </div>
                  <CardDescription>{demo.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link to={demo.path}>查看演示</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
