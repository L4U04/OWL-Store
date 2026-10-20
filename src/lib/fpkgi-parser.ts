// src/lib/fpkgi-parser.ts

export type PackageCategory = 'game' | 'update' | 'dlc' | 'homebrew';

export interface RawFPKGiItem {
  region: 'USA' | 'EUR' | 'JAP' | 'ASIA' | string | null;
  name: string;
  version: string | null;
  release: string | null;
  size: number | string;
  min_fw: string | null;
  cover_url: string | null;
  pkg_url?: string; // Alguns forks colocam pkg_url dentro do objeto, no oficial a chave é a URL
}

export interface RawFPKGiCatalog {
  DATA: Record<string, RawFPKGiItem>;
}

export interface ParsedPkgVariant {
  id: string;
  category: PackageCategory;
  pkgUrl: string;
  version: string;
  sizeBytes: number;
  minFw: string;
  releaseDate: string;
}

export interface UnifiedStoreCard {
  titleId: string;       // Ex: CUSA03041
  contentId: string;     // Ex: UP1004-CUSA03041_00-REDEMPTION000002
  name: string;
  region: string;
  coverUrl: string;
  minFw: string;
  totalSizeBytes: number;
  baseGame?: ParsedPkgVariant;
  updates: ParsedPkgVariant[];
  dlcs: ParsedPkgVariant[];
}

/**
 * Extrai o Title ID (CUSAxxxxx ou formato Homebrew) da URL ou da chave do JSON
 */
export function extractIds(keyOrUrl: string, fallbackName: string): { titleId: string; contentId: string } {
  const contentIdMatch = keyOrUrl.match(/([A-Z]{2}\d{4}-[A-Z]{4}\d{5}_00-[A-Z0-9]{16})/i);
  const cusaMatch = keyOrUrl.match(/(CUSA\d{5}|PKGI\d{5}|BREW\d{5}|PPSA\d{5})/i);

  if (contentIdMatch) {
    const fullContentId = contentIdMatch[1].toUpperCase();
    const extractedCusa = fullContentId.split('-')[1]?.split('_')[0] || 'HOMEBREW';
    return { titleId: extractedCusa, contentId: fullContentId };
  }

  if (cusaMatch) {
    const cusa = cusaMatch[1].toUpperCase();
    return { titleId: cusa, contentId: `UP0000-${cusa}_00-0000000000000000` };
  }

  // Fallback determinístico pelo nome do jogo para agrupar Jogo + Update mesmo sem CUSA na URL
  const normalizedSlug = fallbackName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 9)
    .padEnd(9, '0');

  return {
    titleId: normalizedSlug,
    contentId: `HB0000-${normalizedSlug}_00-0000000000000000`,
  };
}

/**
 * Une múltiplos JSONs do FPKGi (GAMES, UPDATES, DLCs) em Cards unificados por Title ID
 */
export function mergeFPKGiCatalogs(
  catalogs: { category: PackageCategory; data: RawFPKGiCatalog }[]
): UnifiedStoreCard[] {
  const cardMap = new Map<string, UnifiedStoreCard>();

  for (const { category, data } of catalogs) {
    if (!data || !data.DATA) continue;

    for (const [key, item] of Object.entries(data.DATA)) {
      const pkgUrl = item.pkg_url || key;
      const cleanName = item.name.replace(/\s*\((Update\vert{}DLC\vert{}Patch).*?\)/i, '').trim();
      const { titleId, contentId } = extractIds(`${key} ${pkgUrl}`, cleanName);
      const sizeBytes = typeof item.size === 'string' ? parseInt(item.size, 10) || 0 : item.size || 0;

      const variant: ParsedPkgVariant = {
        id: `${titleId}-${category}-${item.version || '1.00'}`,
        category,
        pkgUrl,
        version: item.version || '1.00',
        sizeBytes,
        minFw: item.min_fw || '5.05+',
        releaseDate: item.release || 'N/A',
      };

      if (!cardMap.has(titleId)) {
        cardMap.set(titleId, {
          titleId,
          contentId,
          name: cleanName,
          region: item.region || 'ALL',
          coverUrl: item.cover_url || '/placeholder-cover.png',
          minFw: item.min_fw || '9.00',
          totalSizeBytes: 0,
          updates: [],
          dlcs: [],
        });
      }

      const card = cardMap.get(titleId)!;
      card.totalSizeBytes += sizeBytes;

      // Atualiza capa caso o registro atual tenha uma URL válida
      if (item.cover_url && card.coverUrl === '/placeholder-cover.png') {
        card.coverUrl = item.cover_url;
      }

      if (category === 'game' || category === 'homebrew') {
        card.baseGame = variant;
      } else if (category === 'update') {
        card.updates.push(variant);
      } else if (category === 'dlc') {
        card.dlcs.push(variant);
      }
    }
  }

  return Array.from(cardMap.values());
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}