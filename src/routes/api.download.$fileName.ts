import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const FILES_DIR = path.join(process.cwd(), 'files')

export const Route = createFileRoute('/api/download/$fileName')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const fileName = decodeURIComponent(params.fileName)
        const filePath = path.join(FILES_DIR, fileName)

        try {
          const stats = await fs.promises.stat(filePath)
          const fileBuffer = await fs.promises.readFile(filePath)

          return new Response(fileBuffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': stats.size.toString(),
              'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            },
          })
        } catch {
          return new Response('File not found', { status: 404 })
        }
      },
    },
  },
})
