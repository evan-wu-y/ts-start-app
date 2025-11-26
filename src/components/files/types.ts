export interface FileItem {
  id: string
  name: string
  size: string
  type: 'file' | 'folder'
  uploadDate: string
  modifiedDate: string
  path: string
}

