import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function getNames() {
  return fetch('/demo/api/names').then((res) => res.json() as Promise<string[]>)
}

export const Route = createFileRoute('/_dashboardLayout/demo/api-request')({
  component: ApiRequestDemo,
})

function ApiRequestDemo() {
  const [names, setNames] = useState<Array<string>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getNames()
      .then(setNames)
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>API 请求示例 - 名称列表</CardTitle>
          <CardDescription>
            演示如何从 API 端点获取数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {names.length > 0 ? (
                names.map((name, index) => (
                  <Card key={name} className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
