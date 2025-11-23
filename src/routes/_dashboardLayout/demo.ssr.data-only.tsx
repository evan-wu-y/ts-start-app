import { createFileRoute } from '@tanstack/react-router'
import { getPunkSongs } from '@/data/demo.punk-songs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music2 } from 'lucide-react'

export const Route = createFileRoute('/_dashboardLayout/demo/ssr/data-only')({
  ssr: 'data-only',
  component: DataOnlySSRDemo,
  loader: async () => await getPunkSongs(),
})

function DataOnlySSRDemo() {
  const punkSongs = Route.useLoaderData()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-pink-500" />
            <CardTitle>Data Only SSR - 朋克歌曲</CardTitle>
          </div>
          <CardDescription>
            仅数据在服务器端获取，HTML 在客户端渲染
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
