import { useState, useCallback, useEffect } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import { Upload, FileText, Folder, Download, Trash2, MoreVertical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const FILES_DIR = path.join(process.cwd(), 'files')

// 确保目录存在
async function ensureFilesDir() {
  try {
    await fs.promises.access(FILES_DIR)
  } catch {
    await fs.promises.mkdir(FILES_DIR, { recursive: true })
  }
}

interface FileItem {
  id: string
  name: string
  size: string
  type: 'file' | 'folder'
  uploadDate: string
  modifiedDate: string
  path: string
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 获取文件列表
const getFiles = createServerFn({
  method: 'GET',
}).handler(async () => {
  await ensureFilesDir()
  const files: FileItem[] = []

  try {
    const entries = await fs.promises.readdir(FILES_DIR, { withFileTypes: true })

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
    // 文件夹排在前面
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }
    // 按修改时间倒序
    return new Date(b.modifiedDate).getTime() - new Date(a.modifiedDate).getTime()
  })
})

// 上传文件 - 接收文件数据数组
interface FileUploadData {
  name: string
  data: string // base64 编码的文件内容
}

const uploadFile = createServerFn({
  method: 'POST',
})
  .inputValidator((d: FileUploadData[]) => d)
  .handler(async ({ data }) => {
    await ensureFilesDir()

    const uploadedFiles: FileItem[] = []

    for (const fileData of data) {
      const buffer = Buffer.from(fileData.data, 'base64')
      const filePath = path.join(FILES_DIR, fileData.name)

      // 如果文件已存在，添加时间戳
      let finalPath = filePath
      if (await fs.promises.access(finalPath).then(() => true).catch(() => false)) {
        const ext = path.extname(fileData.name)
        const name = path.basename(fileData.name, ext)
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

    return uploadedFiles
  })

// 删除文件
const deleteFile = createServerFn({
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

// 下载文件
const downloadFile = createServerFn({
  method: 'POST',
})
  .inputValidator((d: string) => d)
  .handler(async ({ data: fileName }) => {
    if (!fileName) {
      throw new Error('文件名不能为空')
    }

    const filePath = path.join(FILES_DIR, fileName)

    try {
      const stats = await fs.promises.stat(filePath)
      if (!stats.isFile()) {
        throw new Error('不是文件')
      }

      const buffer = await fs.promises.readFile(filePath)
      return {
        fileName,
        buffer: buffer.toString('base64'),
        size: stats.size,
      }
    } catch (error) {
      console.error('读取文件失败:', error)
      throw new Error('读取文件失败')
    }
  })

export const Route = createFileRoute('/_dashboardLayout/files')({
  component: Files,
  loader: async () => await getFiles(),
})

function Files() {
  const router = useRouter()
  const initialFiles = Route.useLoaderData()
  const [files, setFiles] = useState<FileItem[]>(initialFiles || [])
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)

  // 当 loader 数据更新时，同步到 state
  useEffect(() => {
    if (initialFiles) {
      setFiles(initialFiles)
    }
  }, [initialFiles])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setIsUploading(true)
    try {
      // 将文件转换为 base64 数组
      const fileDataArray: FileUploadData[] = []

      for (const file of Array.from(selectedFiles)) {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            '',
          ),
        )
        fileDataArray.push({
          name: file.name,
          data: base64,
        })
      }

      await uploadFile({ data: fileDataArray })

      // 刷新文件列表
      await router.invalidate()
      toast.success('文件上传成功')
    } catch (error) {
      console.error('上传文件失败:', error)
      toast.error('上传文件失败，请重试')
    } finally {
      setIsUploading(false)
      // 清空 input
      event.target.value = ''
    }
  }, [router])

  const handleDeleteClick = useCallback((file: FileItem) => {
    setFileToDelete(file)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return

    setIsDeleting(fileToDelete.id)
    setDeleteDialogOpen(false)

    try {
      await deleteFile({ data: fileToDelete.name })

      // 刷新文件列表
      await router.invalidate()
      toast.success(`文件 "${fileToDelete.name}" 已删除`)
      setFileToDelete(null)
    } catch (error) {
      console.error('删除文件失败:', error)
      toast.error('删除文件失败，请重试')
    } finally {
      setIsDeleting(null)
    }
  }, [fileToDelete, router])

  const handleDownload = useCallback(async (file: FileItem) => {
    try {
      const result = await downloadFile({ data: file.name })

      // 将 base64 转换为 blob 并下载
      const binaryString = atob(result.buffer)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('文件下载开始')
    } catch (error) {
      console.error('下载文件失败:', error)
      toast.error('下载文件失败，请重试')
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground">上传和管理您的文件</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">
            <FileText className="mr-2 h-4 w-4" />
            文件列表
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            上传文件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>所有文件</CardTitle>
              <CardDescription>查看和管理您的所有文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Folder className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">暂无文件</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      点击"上传文件"标签页开始上传
                    </p>
                  </div>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          {file.type === 'folder' ? (
                            <Folder className="h-5 w-5 text-blue-500" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{file.size}</span>
                            <span>上传于 {file.uploadDate}</span>
                            {file.modifiedDate !== file.uploadDate && (
                              <span>修改于 {file.modifiedDate}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.type === 'file' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isDeleting === file.id}>
                              {isDeleting === file.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {file.type === 'file' && (
                              <DropdownMenuItem onClick={() => handleDownload(file)}>
                                <Download className="mr-2 h-4 w-4" />
                                下载
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(file)}
                              className="text-destructive"
                              disabled={isDeleting === file.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>上传文件</CardTitle>
              <CardDescription>选择文件并上传到服务器</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border-2 border-dashed rounded-lg p-12 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">拖拽文件到此处或点击上传</p>
                    <p className="text-sm text-muted-foreground">
                      支持单个或多个文件上传
                    </p>
                  </div>
                  <div className="mt-6">
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isUploading}
                    />
                    <Button asChild disabled={isUploading}>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            选择文件
                          </>
                        )}
                      </label>
                    </Button>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">最近上传的文件</h3>
                    <div className="space-y-2">
                      {files.slice(0, 3).map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{file.size}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文件 "{fileToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

