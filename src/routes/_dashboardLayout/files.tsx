import { useState, useCallback, useEffect } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { uploadWithProgress } from '@/lib/upload'
import { downloadWithProgress } from '@/lib/download'
import { getFiles, deleteFile } from '@/lib/file-server'
import {
  FileList,
  FileUpload,
  DeleteDialog,
  type FileItem,
} from '@/components/files'

// ============================================================================
// Route Configuration
// ============================================================================

export const Route = createFileRoute('/_dashboardLayout/files')({
  component: Files,
  loader: () => getFiles(),
})

// ============================================================================
// Custom Hooks
// ============================================================================

function useFileSelection(files: FileItem[]) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)))
    }
  }, [files, selectedFiles.size])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  return {
    selectedFiles,
    toggleSelectFile,
    toggleSelectAll,
    clearSelection,
  }
}

function useFileUpload(onSuccess: () => void) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFilesUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return

      setIsUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }

      uploadWithProgress({
        url: '/api/upload',
        formData,
        onProgress: (percent) => setUploadProgress(percent),
        onSuccess: () => {
          onSuccess()
          toast.success('文件上传成功')
          setIsUploading(false)
          setUploadProgress(0)
        },
        onError: () => {
          toast.error('上传文件失败，请重试')
          setIsUploading(false)
          setUploadProgress(0)
        },
      })
    },
    [onSuccess],
  )

  return { isUploading, uploadProgress, handleFilesUpload }
}

function useFileDelete(onSuccess: () => void) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)

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
      onSuccess()
      toast.success('文件已删除')
    } catch (error) {
      console.error('删除文件失败:', error)
      toast.error('删除文件失败，请重试')
    } finally {
      setIsDeleting(null)
      setFileToDelete(null)
    }
  }, [fileToDelete, onSuccess])

  return {
    isDeleting,
    deleteDialogOpen,
    setDeleteDialogOpen,
    fileToDelete,
    handleDeleteClick,
    handleDeleteConfirm,
  }
}

function useBatchDelete(
  selectedFiles: Set<string>,
  files: FileItem[],
  onSuccess: () => void,
  clearSelection: () => void,
) {
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)

  const handleBatchDeleteClick = useCallback(() => {
    if (selectedFiles.size === 0) return
    setBatchDeleteDialogOpen(true)
  }, [selectedFiles.size])

  const handleBatchDeleteConfirm = useCallback(async () => {
    if (selectedFiles.size === 0) return

    setIsBatchDeleting(true)
    setBatchDeleteDialogOpen(false)

    try {
      const filesToDelete = files.filter((f) => selectedFiles.has(f.id))
      await Promise.all(filesToDelete.map((f) => deleteFile({ data: f.name })))
      clearSelection()
      onSuccess()
      toast.success(`已删除 ${filesToDelete.length} 个文件`)
    } catch (error) {
      console.error('批量删除失败:', error)
      toast.error('批量删除失败，请重试')
    } finally {
      setIsBatchDeleting(false)
    }
  }, [selectedFiles, files, onSuccess, clearSelection])

  return {
    isBatchDeleting,
    batchDeleteDialogOpen,
    setBatchDeleteDialogOpen,
    handleBatchDeleteClick,
    handleBatchDeleteConfirm,
  }
}

function useBatchDownload(selectedFiles: Set<string>, files: FileItem[]) {
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)
  const [downloadingFiles, setDownloadingFiles] = useState<Map<string, number>>(
    new Map(),
  )

  const handleBatchDownload = useCallback(() => {
    if (selectedFiles.size === 0) return

    setIsBatchDownloading(true)
    const filesToDownload = files.filter((f) => selectedFiles.has(f.id))

    // 初始化所有文件的下载进度为0
    const initialProgress = new Map<string, number>()
    filesToDownload.forEach((f) => initialProgress.set(f.id, 0))
    setDownloadingFiles(initialProgress)

    let completedCount = 0
    const totalCount = filesToDownload.length

    // 同时开始所有文件的下载
    filesToDownload.forEach((file) => {
      downloadWithProgress({
        url: `/api/download/${encodeURIComponent(file.name)}`,
        fileName: file.name,
        onProgress: (percent) => {
          setDownloadingFiles((prev) => {
            const next = new Map(prev)
            next.set(file.id, percent)
            return next
          })
        },
        onSuccess: () => {
          completedCount++
          setDownloadingFiles((prev) => {
            const next = new Map(prev)
            next.delete(file.id)
            return next
          })

          if (completedCount === totalCount) {
            setIsBatchDownloading(false)
            toast.success(`已下载 ${totalCount} 个文件`)
          }
        },
        onError: () => {
          completedCount++
          setDownloadingFiles((prev) => {
            const next = new Map(prev)
            next.delete(file.id)
            return next
          })

          if (completedCount === totalCount) {
            setIsBatchDownloading(false)
            toast.error('部分文件下载失败')
          }
        },
      })
    })
  }, [selectedFiles, files])

  return {
    isBatchDownloading,
    downloadingFiles,
    handleBatchDownload,
  }
}

// ============================================================================
// Page Component
// ============================================================================

function Files() {
  const router = useRouter()
  const initialFiles = Route.useLoaderData()
  const [files, setFiles] = useState<FileItem[]>(initialFiles || [])

  useEffect(() => {
    if (initialFiles) {
      setFiles(initialFiles)
    }
  }, [initialFiles])

  const refreshFiles = useCallback(async () => {
    await router.invalidate()
  }, [router])

  const { selectedFiles, toggleSelectFile, toggleSelectAll, clearSelection } =
    useFileSelection(files)

  const { isUploading, uploadProgress, handleFilesUpload } =
    useFileUpload(refreshFiles)

  const {
    isDeleting,
    deleteDialogOpen,
    setDeleteDialogOpen,
    fileToDelete,
    handleDeleteClick,
    handleDeleteConfirm,
  } = useFileDelete(refreshFiles)

  const {
    isBatchDeleting,
    batchDeleteDialogOpen,
    setBatchDeleteDialogOpen,
    handleBatchDeleteClick,
    handleBatchDeleteConfirm,
  } = useBatchDelete(selectedFiles, files, refreshFiles, clearSelection)

  const { isBatchDownloading, downloadingFiles, handleBatchDownload } =
    useBatchDownload(selectedFiles, files)

  const recentFiles = files.slice(0, 5)

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground">上传、下载和管理您的文件</p>
        </div>
      </div>

      <Tabs defaultValue="upload" className="space-y-4 w-full">
        <TabsList>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            文件列表
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            上传文件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4">
          <FileList
            files={files}
            selectedFiles={selectedFiles}
            deletingFileId={isDeleting}
            isBatchDeleting={isBatchDeleting}
            isBatchDownloading={isBatchDownloading}
            downloadingFiles={downloadingFiles}
            onSelectFile={toggleSelectFile}
            onSelectAll={toggleSelectAll}
            onDelete={handleDeleteClick}
            onBatchDelete={handleBatchDeleteClick}
            onBatchDownload={handleBatchDownload}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <FileUpload
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            recentFiles={recentFiles}
            onFilesSelect={handleFilesUpload}
            onDeleteFile={handleDeleteClick}
          />
        </TabsContent>
      </Tabs>

      {/* 单文件删除确认对话框 */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description={`确定要删除文件 "${fileToDelete?.name}" 吗？此操作无法撤销。`}
        onConfirm={handleDeleteConfirm}
      />

      {/* 批量删除确认对话框 */}
      <DeleteDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        title="确认批量删除"
        description={`确定要删除选中的 ${selectedFiles.size} 个文件吗？此操作无法撤销。`}
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  )
}
