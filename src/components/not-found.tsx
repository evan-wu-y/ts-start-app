import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { Home, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface NotFoundProps {
  /** 外层容器的样式类名，默认为 min-h-screen（全局） */
  containerClassName?: string
  /** 返回按钮的目标路径，默认为 "/" */
  homeTo?: string
  /** 返回按钮的文本，默认为 "返回首页" */
  homeText?: string
  /** 是否显示返回上一页按钮的图标，默认为 true */
  showBackIcon?: boolean
}

export function NotFound({
  containerClassName = 'flex min-h-screen items-center justify-center p-4',
  homeTo = '/',
  homeText = '返回首页',
  showBackIcon = true,
}: NotFoundProps = {}) {
  const location = useLocation()
  const router = useRouter()

  return (
    <div className={containerClassName}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            页面未找到
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-2">
          <p className="text-muted-foreground">
            抱歉，您访问的页面不存在或已被移动。
          </p>
          {location.pathname && (
            <p className="text-sm text-muted-foreground font-mono">
              路径: {location.pathname}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button asChild variant="default">
            <Link to={homeTo}>
              <Home className="mr-2 h-4 w-4" />
              {homeText}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.history.back()}>
            {showBackIcon && <ArrowLeft className="mr-2 h-4 w-4" />}
            返回上一页
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/** Dashboard 专用的 NotFound 组件 */
export function DashboardNotFound() {
  return (
    <NotFound
      containerClassName="flex h-full items-center justify-center p-8"
      homeTo="/dashboard"
      homeText="返回仪表盘"
      showBackIcon={false}
    />
  )
}

