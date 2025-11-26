import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import { formatFileSize } from './file-utils'
import type { FileItem } from '@/components/files'

const FILES_DIR = path.join(process.cwd(), 'uploads-files')

async function ensureFilesDir() {
  try {
    await fs.promises.access(FILES_DIR)
  } catch {
    await fs.promises.mkdir(FILES_DIR, { recursive: true })
  }
}

export const getFiles = createServerFn({
  method: 'GET',
}).handler(async () => {
  await ensureFilesDir()
  const files: FileItem[] = []

  try {
    const entries = await fs.promises.readdir(FILES_DIR, {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const filePath = path.join(FILES_DIR, entry.name)
      const stats = await fs.promises.stat(filePath)

      files.push({
        id: entry.name,
        name: entry.name,
        size: entry.isFile() ? formatFileSize(stats.size) : '-',
        type: entry.isDirectory() ? 'folder' : 'file',
        uploadDate: stats.birthtime.toISOString().split('T')[0],
        modifiedDate: stats.mtime.toISOString().split('T')[0],
        path: filePath,
      })
    }
  } catch (error) {
    console.error('读取文件列表失败:', error)
  }

  return files.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }
    return (
      new Date(b.modifiedDate).getTime() - new Date(a.modifiedDate).getTime()
    )
  })
})

export const deleteFile = createServerFn({
  method: 'POST',
})
  .inputValidator((d: string) => d)
  .handler(async ({ data: fileName }) => {
    if (!fileName) {
      throw new Error('文件名不能为空')
    }

    const filePath = path.join(FILES_DIR, fileName)

    try {
      await fs.promises.unlink(filePath)
      return { success: true }
    } catch (error) {
      console.error('删除文件失败:', error)
      throw new Error('删除文件失败')
    }
  })

export const downloadFile = createServerFn({
  method: 'POST',
})
  .inputValidator((d: string) => d)
  .handler(async ({ data: fileName }) => {
    if (!fileName) {
      throw new Error('文件名不能为空')
    }

    const filePath = path.join(FILES_DIR, fileName)

    try {
      const fileBuffer = await fs.promises.readFile(filePath)
      const base64 = fileBuffer.toString('base64')
      return { base64, fileName }
    } catch (error) {
      console.error('读取文件失败:', error)
      throw new Error('读取文件失败')
    }
  })
