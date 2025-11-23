import { createFileRoute } from '@tanstack/react-router'
import { getPunkSongs } from '@/data/demo.punk-songs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music2 } from 'lucide-react'

export const Route = createFileRoute('/_dashboardLayout/demo/ssr/full-ssr')({
  component: FullSSRDemo,
  loader: async () => await getPunkSongs(),
})

function FullSSRDemo() {
  const punkSongs = Route.useLoaderData()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-purple-500" />
            <CardTitle>Full SSR - 朋克歌曲</CardTitle>
          </div>
          <CardDescription>
            完整的服务器端渲染，包括 HTML 和数据都在服务器端生成
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {punkSongs.map((song) => (
              <Card key={song.id} className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{song.id}</Badge>
                    <div className="flex-1">
                      <p className="font-medium">{song.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {song.artist}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
