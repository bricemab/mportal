import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { badRequest, notFound } from './errors'

export type StorageArea = 'invoices' | 'contracts'

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,120}$/i

/**
 * Stockage de fichiers hors du dossier public, dans STORAGE_DIR.
 * Les noms sont générés par le serveur ; aucun chemin fourni par l'utilisateur n'est utilisé tel quel.
 */
export class FileStorage {
  private readonly root: string

  constructor(rootDir: string) {
    this.root = resolve(rootDir)
  }

  private pathFor(area: StorageArea, name: string): string {
    if (!SAFE_NAME.test(name)) throw badRequest('Nom de fichier invalide')
    const dir = resolve(this.root, area)
    const full = resolve(dir, name)
    if (!full.startsWith(dir + sep)) throw badRequest('Chemin invalide')
    return full
  }

  async save(area: StorageArea, prefix: string, extension: string, content: Buffer): Promise<string> {
    const safePrefix = prefix.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'file'
    const name = `${safePrefix}-${randomBytes(12).toString('hex')}.${extension.replace(/[^a-z0-9]/gi, '')}`
    await mkdir(join(this.root, area), { recursive: true })
    await writeFile(this.pathFor(area, name), content, { mode: 0o600 })
    return name
  }

  async read(area: StorageArea, name: string): Promise<Buffer> {
    try {
      return await readFile(this.pathFor(area, name))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound('Fichier introuvable')
      throw error
    }
  }

  async remove(area: StorageArea, name: string): Promise<void> {
    await rm(this.pathFor(area, name), { force: true })
  }
}

/** Vérifie la signature binaire d'un PDF (%PDF-). */
export function isPdf(content: Buffer): boolean {
  return content.subarray(0, 5).toString('latin1') === '%PDF-'
}

/** Vérifie qu'un fichier ressemble à du XML. */
export function isXml(content: Buffer): boolean {
  const head = content.subarray(0, 200).toString('utf8').replace(/^﻿/, '').trimStart()
  return head.startsWith('<?xml') || head.startsWith('<Document')
}
