import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FileItemRow } from './file-item-row'
import type { FileItem } from './types'

interface FileUploadProps {
  isUploading: boolean
  uploadProgress: number
  recentFiles: FileItem[]
  onFilesSelect: (files: File[]) => void
  onDeleteFile: (file: FileItem) => void
}

export function FileUpload({
  isUploading,
  uploadProgress,
  recentFiles,
  onFilesSelect,
  onDeleteFile,
}: FileUploadProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>上传文件</CardTitle>
        <CardDescription>选择文件并上传到服务器</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <UploadArea
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onFilesSelect={onFilesSelect}
          />
          {recentFiles.length > 0 && (
            <RecentFiles files={recentFiles} onDelete={onDeleteFile} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface UploadAreaProps {
  isUploading: boolean
  uploadProgress: number
  onFilesSelect: (files: File[]) => void
}

function UploadArea({
  isUploading,
  uploadProgress,
  onFilesSelect,
}: UploadAreaProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelect(acceptedFiles)
      }
    },
    [onFilesSelect],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isUploading,
    multiple: true,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
      } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <Upload
        className={`mx-auto h-12 w-12 mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`}
      />
      <div className="space-y-2">
        <p className="text-lg font-medium">
          {isDragActive ? '松开以上传文件' : '拖拽文件到此处或点击上传'}
        </p>
        <p className="text-sm text-muted-foreground">支持单个或多个文件上传</p>
      </div>
      <div className="mt-6">
        <Button disabled={isUploading} type="button">
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
        </Button>
      </div>

      {isUploading && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>上传进度</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
    </div>
  )
}

interface RecentFilesProps {
  files: FileItem[]
  onDelete: (file: FileItem) => void
}

function RecentFiles({ files, onDelete }: RecentFilesProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">最近上传的文件</h3>
      <div className="space-y-2">
        {files.slice(0, 3).map((file) => (
          <FileItemRow
            key={file.id}
            file={file}
            onDelete={() => onDelete(file)}
            hideCheckbox
          />
        ))}
      </div>
    </div>
  )
}
