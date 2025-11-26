import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import { formatFileSize } from '@/lib/file-utils'

const FILES_DIR = path.join(process.cwd(), 'files')

async function ensureFilesDir() {
  try {
    await fs.promises.access(FILES_DIR)
  } catch {
    await fs.promises.mkdir(FILES_DIR, { recursive: true })
  }
}

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureFilesDir()

        const formData = await request.formData()
        const files = formData.getAll('files') as File[]
        const uploadedFiles = []

        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          let finalPath = path.join(FILES_DIR, file.name)

          // 如果文件已存在，添加时间戳
          if (
            await fs.promises
              .access(finalPath)
              .then(() => true)
              .catch(() => false)
          ) {
            const ext = path.extname(file.name)
            const name = path.basename(file.name, ext)
            const timestamp = Date.now()
            finalPath = path.join(FILES_DIR, `${name}_${timestamp}${ext}`)
          }

          await fs.promises.writeFile(finalPath, buffer)
          const stats = await fs.promises.stat(finalPath)

          uploadedFiles.push({
            id: path.basename(finalPath),
            name: path.basename(finalPath),
            size: formatFileSize(stats.size),
            type: 'file',
            uploadDate: stats.birthtime.toISOString().split('T')[0],
            modifiedDate: stats.mtime.toISOString().split('T')[0],
            path: finalPath,
          })
        }

        return json(uploadedFiles)
      },
    },
  },
})
