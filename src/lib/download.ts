export interface DownloadOptions {
  url: string
  fileName: string
  onProgress?: (percent: number) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export async function downloadWithProgress({
  url,
  fileName,
  onProgress,
  onSuccess,
  onError,
}: DownloadOptions): Promise<void> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`)
    }

    const contentLength = response.headers.get('Content-Length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      if (total && onProgress) {
        const percent = Math.round((receivedLength / total) * 100)
        onProgress(percent)
      }
    }

    const blob = new Blob(chunks)
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    a.click()
    URL.revokeObjectURL(downloadUrl)

    onSuccess?.()
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Download failed'))
  }
}

