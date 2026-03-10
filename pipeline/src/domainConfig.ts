/**
 * Per-domain quality tuning overrides.
 *
 * Each domain's overrides live in a separate sidecar file:
 *   .entity-cache/domain-config/{domain}.json
 *
 * This allows parallel agents to write their own domain's config without
 * file conflicts. This module merges all sidecars at import time.
 *
 * All fields are optional; unset fields fall back to global defaults in puzzleComposer.ts.
 */

import * as fs from 'fs'
import * as path from 'path'
import { CategoryDomain } from './wikidata'

export interface DomainOverrides {
  /** Minimum composite quality score (0-100) for a path to be a candidate. Default: 40 */
  minQualityScore?: number
  /** Max fraction of intermediate nodes that can be hubs. Default: 0.0 */
  maxHubRatio?: number
  /** Reject anchor pairs sharing more than this many mutual neighbours. Default: 3 */
  maxMutualNeighbors?: number
  /** relatedIds threshold above which a node is considered a hub. Default: 50 */
  hubRelatedIdsThreshold?: number
  /**
   * Override the per-difficulty anchor familiarity floor.
   * Set to 0 for domains without pageview enrichment (e.g. MusicBrainz).
   * When set, this value is used for ALL difficulties instead of the defaults (40/20/0).
   */
  minAnchorFamiliarity?: number
  /**
   * Cap the entity limit for this domain. When set, the pipeline will not retry with
   * a higher limit than this (avoids Wikidata timeouts on domains with small graphs).
   */
  maxEntityLimit?: number
}

const CONFIG_DIR = path.join(__dirname, '../../.entity-cache/domain-config')

/** Read the sidecar config for a single domain (returns {} if not found) */
export function readDomainOverrides(domain: CategoryDomain): DomainOverrides {
  const file = path.join(CONFIG_DIR, `${domain}.json`)
  if (!fs.existsSync(file)) return {}
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return {} }
}

/** Write overrides for a single domain to its sidecar file */
export function writeDomainOverrides(domain: CategoryDomain, overrides: DomainOverrides): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(path.join(CONFIG_DIR, `${domain}.json`), JSON.stringify(overrides, null, 2))
}

/** Merged view of all domain configs (loaded once at import time for the main pipeline) */
export const DOMAIN_CONFIG: Partial<Record<CategoryDomain, DomainOverrides>> = (() => {
  if (!fs.existsSync(CONFIG_DIR)) return {}
  const result: Partial<Record<CategoryDomain, DomainOverrides>> = {}
  for (const file of fs.readdirSync(CONFIG_DIR)) {
    if (!file.endsWith('.json')) continue
    const domain = file.replace('.json', '') as CategoryDomain
    try { result[domain] = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8')) } catch {}
  }
  return result
})()
