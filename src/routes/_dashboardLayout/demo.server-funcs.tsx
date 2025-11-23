import fs from 'node:fs'
import { useCallback, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const TODOS_FILE = 'todos.json'

async function readTodos() {
  return JSON.parse(
    await fs.promises.readFile(TODOS_FILE, 'utf-8').catch(() =>
      JSON.stringify(
        [
          { id: 1, name: 'Get groceries' },
          { id: 2, name: 'Buy a new phone' },
        ],
        null,
        2,
      ),
    ),
  )
}

const getTodos = createServerFn({
  method: 'GET',
}).handler(async () => await readTodos())

const addTodo = createServerFn({ method: 'POST' })
  .inputValidator((d: string) => d)
  .handler(async ({ data }) => {
    const todos = await readTodos()
    todos.push({ id: todos.length + 1, name: data })
    await fs.promises.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2))
    return todos
  })

export const Route = createFileRoute('/_dashboardLayout/demo/server-funcs')({
  component: ServerFuncsDemo,
  loader: async () => await getTodos(),
})

function ServerFuncsDemo() {
  const router = useRouter()
  let todos = Route.useLoaderData()
  const [todo, setTodo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitTodo = useCallback(async () => {
    if (todo.trim().length === 0) return
    setIsSubmitting(true)
    try {
      todos = await addTodo({ data: todo })
      setTodo('')
      router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }, [addTodo, todo, router])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>服务器函数示例 - Todo 列表</CardTitle>
          <CardDescription>
            使用 TanStack Start 的服务器函数来管理待办事项
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">待办事项列表</h3>
            {todos && todos.length > 0 ? (
              <div className="space-y-2">
                {todos.map((t: { id: number; name: string }) => (
                  <Card key={t.id} className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t.id}</Badge>
                        <span className="text-sm">{t.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无待办事项</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              value={todo}
              onChange={(e) => setTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  submitTodo()
                }
              }}
              placeholder="输入新的待办事项..."
              disabled={isSubmitting}
              className="flex-1"
            />
            <Button
              onClick={submitTodo}
              disabled={todo.trim().length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  添加
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
