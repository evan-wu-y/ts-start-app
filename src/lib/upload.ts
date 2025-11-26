export interface UploadOptions {
  url: string
  formData: FormData
  onProgress?: (percent: number) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function uploadWithProgress({
  url,
  formData,
  onProgress,
  onSuccess,
  onError,
}: UploadOptions): XMLHttpRequest {
  const xhr = new XMLHttpRequest()

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable && onProgress) {
      const percent = Math.round((e.loaded / e.total) * 100)
      onProgress(percent)
    }
  }

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onSuccess?.()
    } else {
      onError?.(new Error(`Upload failed with status ${xhr.status}`))
    }
  }

  xhr.onerror = () => {
    onError?.(new Error('Upload failed'))
  }

  xhr.open('POST', url)
  xhr.send(formData)

  return xhr
}
