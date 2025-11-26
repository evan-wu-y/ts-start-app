import fs from 'node:fs'
import path from 'node:path'

export const FILES_DIR = path.join(process.cwd(), 'uploads-files')

export async function ensureFilesDir() {
  try {
    await fs.promises.access(FILES_DIR)
  } catch {
    await fs.promises.mkdir(FILES_DIR, { recursive: true })
  }
}

