import { memo, useState } from 'react'
import {
  FileText,
  Folder,
  Download,
  Trash2,
  MoreVertical,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { downloadWithProgress } from '@/lib/download'
import type { FileItem } from './types'

interface FileItemRowProps {
  file: FileItem
  isSelected?: boolean
  isDeleting?: boolean
  isDownloading?: boolean
  downloadProgress?: number
  onSelect?: () => void
  onDelete?: () => void
  onDownload?: () => void
  hideCheckbox?: boolean
}

export const FileItemRow = memo(function FileItemRow({
  file,
  isSelected,
  isDeleting,
  isDownloading: externalIsDownloading,
  downloadProgress: externalDownloadProgress,
  onSelect,
  hideCheckbox,
  onDelete,
  onDownload,
}: FileItemRowProps) {
  const [internalIsDownloading, setInternalIsDownloading] = useState(false)
  const [internalDownloadProgress, setInternalDownloadProgress] = useState(0)

  // 使用外部状态（如果提供）或内部状态
  const isDownloading = externalIsDownloading ?? internalIsDownloading
  const downloadProgress = externalDownloadProgress ?? internalDownloadProgress

  const handleDownload = () => {
    if (isDownloading) return

    // 如果提供了外部 onDownload，使用它
    if (onDownload) {
      onDownload()
      return
    }

    // 否则使用内部下载逻辑
    setInternalIsDownloading(true)
    setInternalDownloadProgress(0)

    downloadWithProgress({
      url: `/api/download/${encodeURIComponent(file.name)}`,
      fileName: file.name,
      onProgress: (percent) => setInternalDownloadProgress(percent),
      onSuccess: () => {
        setInternalIsDownloading(false)
        setInternalDownloadProgress(0)
      },
      onError: () => {
        setInternalIsDownloading(false)
        setInternalDownloadProgress(0)
      },
    })
  }

  return (
    <div
      className={`flex flex-col p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
        isSelected ? 'bg-muted/30 border-primary/50' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {!hideCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="shrink-0"
            />
          )}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            {file.type === 'folder' ? (
              <Folder className="h-5 w-5 text-blue-500" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="font-medium truncate cursor-default">
                    {file.name}
                  </p>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-xs break-all"
                >
                  {file.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 truncate">
              <span>{file.size}</span>
              <span className="truncate">上传于 {file.uploadDate}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {file.type === 'file' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {file.type === 'file' && (
                <DropdownMenuItem
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isDownloading && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>下载中...</span>
            <span>{downloadProgress}%</span>
          </div>
          <Progress value={downloadProgress} className="h-1" />
        </div>
      )}
    </div>
  )
})
