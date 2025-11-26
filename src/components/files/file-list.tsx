import { Folder, Trash2, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FileItemRow } from './file-item-row'
import type { FileItem } from './types'

interface FileListProps {
  files: FileItem[]
  selectedFiles: Set<string>
  deletingFileId: string | null
  isBatchDeleting: boolean
  isBatchDownloading: boolean
  downloadingFiles: Map<string, number>
  onSelectFile: (fileId: string) => void
  onSelectAll: () => void
  onDelete: (file: FileItem) => void
  onBatchDelete: () => void
  onBatchDownload: () => void
}

export function FileList({
  files,
  selectedFiles,
  deletingFileId,
  isBatchDeleting,
  isBatchDownloading,
  downloadingFiles,
  onSelectFile,
  onSelectAll,
  onDelete,
  onBatchDelete,
  onBatchDownload,
}: FileListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>所有文件</CardTitle>
            <CardDescription>
              共 {files.length} 个文件
              {selectedFiles.size > 0 && `，已选择 ${selectedFiles.size} 个`}
            </CardDescription>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSelectAll}>
                {selectedFiles.size === files.length ? '取消全选' : '全选'}
              </Button>
              {selectedFiles.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBatchDownload}
                    disabled={isBatchDownloading}
                  >
                    {isBatchDownloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    下载选中 ({selectedFiles.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onBatchDelete}
                    disabled={isBatchDeleting}
                  >
                    {isBatchDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    删除选中 ({selectedFiles.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {files.length === 0 ? (
            <EmptyState />
          ) : (
            files.map((file) => (
              <FileItemRow
                key={file.id}
                file={file}
                isSelected={selectedFiles.has(file.id)}
                isDeleting={deletingFileId === file.id}
                isDownloading={downloadingFiles.has(file.id)}
                downloadProgress={downloadingFiles.get(file.id)}
                onSelect={() => onSelectFile(file.id)}
                onDelete={() => onDelete(file)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Folder className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground">暂无文件</p>
      <p className="text-sm text-muted-foreground mt-2">
        点击"上传文件"标签页开始上传
      </p>
    </div>
  )
}
