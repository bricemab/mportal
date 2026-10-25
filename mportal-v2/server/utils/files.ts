import type { H3Event } from 'h3'
import { readMultipartFormData, setHeader } from 'h3'
import { FileStorage } from '../domain/storage'
import type { PdfAssets } from '../domain/pdf/common'
import { badRequest } from '../domain/errors'

let storage: FileStorage | null = null
let assets: PdfAssets | null = null

export function useFileStorage(): FileStorage {
  storage ??= new FileStorage(useRuntimeConfig().storageDir)
  return storage
}

async function readAsset(name: string): Promise<Buffer> {
  const raw = await useStorage('assets:pdf').getItemRaw<Buffer | Uint8Array>(name)
  if (!raw) throw new Error(`Ressource PDF manquante : ${name}`)
  return Buffer.from(raw)
}

export async function usePdfAssets(): Promise<PdfAssets> {
  assets ??= {
    logo: await readAsset('logo.png'),
    fontRegular: await readAsset('Outfit-Regular.ttf'),
    fontBold: await readAsset('Outfit-Bold.ttf'),
  }
  return assets
}

export function sendPdf(event: H3Event, content: Buffer, fileName: string, inline = false) {
  const safe = fileName.replace(/[^\w.\- ]/g, '_')
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safe}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return content
}

export interface UploadedFile {
  name: string
  data: Buffer
  type: string | undefined
}

/** Lit un unique fichier envoyé en multipart (champ « file »), avec une limite de taille. */
export async function readSingleFile(event: H3Event, maxBytes: number): Promise<{ file: UploadedFile; fields: Record<string, string> }> {
  const parts = await readMultipartFormData(event)
  if (!parts) throw badRequest('Aucun fichier reçu')
  const fields: Record<string, string> = {}
  let file: UploadedFile | null = null
  for (const part of parts) {
    if (part.name === 'file' && part.filename) {
      if (file) throw badRequest('Un seul fichier à la fois')
      file = { name: part.filename.slice(0, 200), data: part.data, type: part.type }
    } else if (part.name) {
      fields[part.name] = part.data.toString('utf8').slice(0, 1000)
    }
  }
  if (!file) throw badRequest('Aucun fichier reçu')
  if (file.data.length === 0) throw badRequest('Fichier vide')
  if (file.data.length > maxBytes) throw badRequest(`Fichier trop volumineux (max ${Math.round(maxBytes / 1_000_000)} Mo)`)
  return { file, fields }
}
