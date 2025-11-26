import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { FILES_DIR } from '@/lib/file-server-utils'

export const Route = createFileRoute('/api/download/$fileName')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const fileName = params.fileName
        if (!fileName) {
          return new Response('文件名不能为空', { status: 400 })
        }

        const filePath = path.join(FILES_DIR, fileName)

        try {
          const stats = await fs.promises.stat(filePath)
          if (!stats.isFile()) {
            return new Response('不是文件', { status: 400 })
          }

          const fileBuffer = await fs.promises.readFile(filePath)

          return new Response(fileBuffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
              'Content-Length': stats.size.toString(),
            },
          })
        } catch {
          return new Response('文件不存在', { status: 404 })
        }
      },
    },
  },
})

