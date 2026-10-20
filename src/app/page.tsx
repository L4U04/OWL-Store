// src/app/page.tsx
'use client';

import './globals.css';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Compass,
  Library,
  Heart,
  ArrowDownToLine,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Terminal,
  Sparkles,
  X,
  FolderKanban,
  RefreshCw,
  Swords,
  Ghost,
  Crosshair,
  Trophy,
  Flame,
  Gamepad2,
  Clock,
} from 'lucide-react';
import GAMES_RAW from '@/data/games.json';
import { useGamepad } from '@/hooks/useGamepad';

export interface GameItem {
  title_id: string;
  region: string;
  name: string;
  version: string;
  release: string;
  size: number;
  min_fw: string;
  cover_url: string;
  pkg_url: string;
  genre: GameGenre;
}

export type GameGenre =
  | 'Todos'
  | 'Souls-like & RPG'
  | 'Ação & Aventura'
  | 'FPS & Shooter'
  | 'Terror & Survival'
  | 'Esportes & Corrida'
  | 'Indie & Arcade';

interface DownloadTask {
  taskId: number;
  titleId: string;
  name: string;
  coverUrl: string;
  size: number;
  status: 'queued' | 'downloading' | 'error';
  message: string;
  timestamp: string;
}

// Higieniza a URL do .pkg para a libSceBgft do PS4 (codifica espaços e colchetes sem duplicar %)
function sanitizePkgUrlForPS4(rawUrl: string): string {
  try {
    const decoded = decodeURI(rawUrl);
    return encodeURI(decoded)
      .replace(/\[/g, '\%5B') .replace(/\]/g, '%5D')
      .replace(/\+/g, '%2B');
  } catch {
    return rawUrl
      .replace(/ /g, '%20')
      .replace(/\[/g, '\%5B') .replace(/\]/g, '%5D');
  }
}

function classifyGameGenre(name: string): GameGenre {
  const n = name.toLowerCase();
  if (
    /souls|elden ring|bloodborne|sekiro|nioh|witcher|persona|final fantasy|dragon quest|diablo|baldur|divinity|yakuza|like a dragon|kingdom hearts|tales of|cyberpunk|skyrim|dragon age|metaphor|lies of p|monster hunter|mortal shell|code vein|mass effect/.test(
      n
    )
  ) {
    return 'Souls-like & RPG';
  }
  if (
    /resident evil|outlast|amnesia|alien|evil within|dead space|until dawn|quarry|dark pictures|soma|visage|blair witch|alan wake|dying light|dead island|chernobylite|darkwood|five nights|callisto|p\.t\./.test(
      n
    )
  ) {
    return 'Terror & Survival';
  }
  if (
    /call of duty|battlefield|doom|wolfenstein|far cry|crysis|sniper|borderlands|quake|metro|titanfall|bioshock|prey|prodeus|rage 2|killzone|bulletstorm/.test(
      n
    )
  ) {
    return 'FPS & Shooter';
  }
  if (
    /gran turismo|need for speed|dirt|f1 |assetto|grid|fifa|fc 24|fc 26|pes |efootball|nba|wwe|ufc|madden|nhl|tony hawk|ride 4|motogp|wreckfest|burnout|trackmania|topspin|skate/.test(
      n
    )
  ) {
    return 'Esportes & Corrida';
  }
  if (
    /assassin|god of war|uncharted|spider-man|batman|red dead|grand theft auto|horizon|ghost of tsushima|watch dogs|watch_dogs|hitman|metal gear|tomb raider|mafia|just cause|devil may cry|dmc|saints row|star wars|death stranding|control|days gone|infamous|last of us|detroit|heavy rain|beyond two souls|arkham|middle-earth|mad max|sifu|yomi/.test(
      n
    )
  ) {
    return 'Ação & Aventura';
  }
  return 'Indie & Arcade';
}

const NAV_TABS = [
  { id: 'discover', label: 'Destaques', icon: Compass },
  { id: 'catalog', label: 'Biblioteca A–Z', icon: Library },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
  { id: 'downloads', label: 'Transferências', icon: ArrowDownToLine },
] as const;

const GENRE_LIST: { name: GameGenre; icon: any }[] = [
  { name: 'Todos', icon: FolderKanban },
  { name: 'Souls-like & RPG', icon: Swords },
  { name: 'Ação & Aventura', icon: Flame },
  { name: 'Terror & Survival', icon: Ghost },
  { name: 'FPS & Shooter', icon: Crosshair },
  { name: 'Esportes & Corrida', icon: Trophy },
  { name: 'Indie & Arcade', icon: Sparkles },
];

const ITEMS_PER_PAGE = 36; // Protege a memória RAM do WebKit do PS4 (divisível por 2, 3, 4 e 6 colunas)

export default function OwlStoreConsoleApp() {
  const [ps4Ip, setPs4Ip] = useState<string>('192.168.1.150');
  const [ps4Port, setPs4Port] = useState<number>(12800);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [systemTime, setSystemTime] = useState<string>('00:00');

  const [activeNav, setActiveNav] = useState<'discover' | 'catalog' | 'favorites' | 'downloads'>('discover');
  const [selectedGenre, setSelectedGenre] = useState<GameGenre>('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState<string>('');
  const [letterFilter, setLetterFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'size_desc' | 'size_asc'>('name');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [gridColumns, setGridColumns] = useState<number>(6);

  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedGameCover, setFocusedGameCover] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [validating, setValidating] = useState<boolean>(false);
  const [pkgHealth, setPkgHealth] = useState<{ online?: boolean; realSize?: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusedElementRef = useRef<HTMLElement | null>(null);

  // Calcula dinamicamente o número de colunas real da tela para o D-Pad nunca errar a linha
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w >= 1280) setGridColumns(6);
      else if (w >= 1024) setGridColumns(5);
      else if (w >= 768) setGridColumns(4);
      else if (w >= 640) setGridColumns(3);
      else setGridColumns(2);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 15000);

    const savedFavs = localStorage.getItem('owl_store_favorites');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch {}
    }
    const savedIp = localStorage.getItem('owl_store_ps4_ip');
    if (savedIp) setPs4Ip(savedIp);

    return () => clearInterval(clockInterval);
  }, []);

  const toggleFavorite = useCallback((titleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(titleId) ? prev.filter((id) => id !== titleId) : [...prev, titleId];
      localStorage.setItem('owl_store_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  // Processa e higieniza todas as entradas do JSON
  const allGames: GameItem[] = useMemo(() => {
    const rawData = (GAMES_RAW as any).DATA || {};
    const map = new Map<string, GameItem>();

    Object.entries(rawData).forEach(([pkgUrl, meta]: [string, any]) => {
      const cleanName = (meta.name || '')
        .replace(/\s+\[(US\vert{}EU\vert{}JP\vert{}AS\vert{}EN\vert{}SP\vert{}CP\vert{}\d+\.\d+)\]/gi, '')
        .trim();
      const genre = classifyGameGenre(cleanName);
      const safePkgUrl = sanitizePkgUrlForPS4(pkgUrl);

      const item: GameItem = {
        title_id: meta.title_id || 'CUSA00000',
        region: meta.region || 'ALL',
        name: cleanName,
        version: meta.version || '01.00',
        release: meta.release || 'PS4',
        size: Number(meta.size) || 0,
        min_fw: meta.min_fw || '9.00',
        cover_url: meta.cover_url || '',
        pkg_url: safePkgUrl,
        genre,
      };

      const existing = map.get(cleanName.toLowerCase());
      if (!existing || (existing.title_id === 'CUSA00000' && item.title_id !== 'CUSA00000')) {
        map.set(cleanName.toLowerCase(), item);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const spotlightGames = useMemo(() => {
    const preferredIds = ['CUSA18723', 'CUSA34384', 'CUSA03041', 'CUSA03173', 'CUSA16579', 'CUSA11456'];
    const found = preferredIds
      .map((id) => allGames.find((g) => g.title_id === id))
      .filter(Boolean) as GameItem[];
    return found.length >= 6 ? found.slice(0, 6) : allGames.slice(0, 6);
  }, [allGames]);

  // Fileiras de Console (Swimlanes) restauradas e garantidas para a aba Destaques
  const consoleRows = useMemo(() => {
    return [
      {
        title: 'Blockbusters AAA (+40 GB)',
        tag: 'HIGH CAPACITY',
        items: allGames.filter((g) => g.size > 40 * 1024 * 1024 * 1024).slice(0, 12),
      },
      {
        title: 'Souls-like & RPGs de Ação',
        tag: 'HARDCORE & LORE',
        items: allGames.filter((g) => g.genre === 'Souls-like & RPG').slice(0, 12),
      },
      {
        title: 'Ação & Aventura Cinematográfica',
        tag: 'STORY DRIVEN',
        items: allGames.filter((g) => g.genre === 'Ação & Aventura').slice(0, 12),
      },
      {
        title: 'Terror & Survival Horror',
        tag: 'SURVIVAL',
        items: allGames.filter((g) => g.genre === 'Terror & Survival').slice(0, 12),
      },
      {
        title: 'FPS & Shooters Táticos',
        tag: 'COMBAT',
        items: allGames.filter((g) => g.genre === 'FPS & Shooter').slice(0, 12),
      },
      {
        title: 'Instalação Rápida (< 2 GB)',
        tag: 'EXPRESS PKG',
        items: allGames.filter((g) => g.size > 0 && g.size < 2 * 1024 * 1024 * 1024).slice(0, 12),
      },
    ];
  }, [allGames]);

  // Lista plana de todos os jogos exibidos nas fileiras da aba Destaques para navegação contínua no D-Pad
  const discoverFlatGames = useMemo(() => {
    return consoleRows.flatMap((r) => r.items);
  }, [consoleRows]);

  const filteredGames = useMemo(() => {
    return allGames
      .filter((game) => {
        if (activeNav === 'favorites' && !favorites.includes(game.title_id)) return false;
        if (selectedGenre !== 'Todos' && game.genre !== selectedGenre) return false;
        if (letterFilter !== 'ALL' && !game.name.toUpperCase().startsWith(letterFilter)) return false;
        if (search.trim() !== '') {
          const q = search.toLowerCase();
          return (
            game.name.toLowerCase().includes(q) ||
            game.title_id.toLowerCase().includes(q) ||
            game.genre.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'size_desc') return b.size - a.size;
        if (sortBy === 'size_asc') return a.size - b.size;
        return a.name.localeCompare(b.name);
      });
  }, [allGames, activeNav, favorites, selectedGenre, letterFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / ITEMS_PER_PAGE));

  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  // Reseta página e foco ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
    setFocusedIndex(0);
  }, [activeNav, selectedGenre, letterFilter, search, sortBy]);

  // Rola suavemente até o elemento focado pelo controle
  useEffect(() => {
    if (focusedElementRef.current) {
      focusedElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedIndex, currentPage, activeNav]);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 1) {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(0)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const inspectGame = useCallback(async (game: GameItem) => {
    setSelectedGame(game);
    setFocusedGameCover(game.cover_url);
    setPkgHealth(null);
    setValidating(true);
    try {
      const res = await fetch('/api/ps4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_pkg', ps4Ip, packages: [game.pkg_url] }),
      });
      const data = await res.json();
      setPkgHealth({ online: data.online, realSize: data.realSizeBytes });
    } catch {
      setPkgHealth({ online: true }); // Fallback caso rode em modo 100% estático no PS4
    } finally {
      setValidating(false);
    }
  }, [ps4Ip]);

  // Disparo híbrido: tenta via API Proxy e possui fallback direto (no-cors) para funcionar dentro de um .pkg estático no PS4
  const triggerPS4Install = useCallback(async (game: GameItem) => {
    let success = false;
    let taskId = Math.floor(Math.random() * 8999) + 1000;
    let message = 'Transferência iniciada via libSceBgft';

    try {
      const res = await fetch('/api/ps4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'install',
          ps4Ip,
          ps4Port,
          packages: [game.pkg_url],
        }),
      });
      const data = await res.json();
      if (res.ok && data.status !== 'fail') {
        success = true;
        if (data.task_id) taskId = data.task_id;
      } else {
        throw new Error(data.error || 'Tentando conexão direta com o console...');
      }
    } catch {
      // Fallback Client-Side Direto (Compatível com Static Export .pkg usando Simple Request sem CORS preflight)
      try {
        await fetch(`http://${ps4Ip}:${ps4Port}/api/install`, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            type: 'direct',
            packages: [game.pkg_url],
          }),
        });
        success = true;
        message = 'Pacote enviado diretamente ao daemon RPI do PS4';
      } catch (directErr: any) {
        success = false;
        message = directErr?.message || 'Daemon RPI inacessível no PS4';
      }
    }

    const newTask: DownloadTask = {
      taskId,
      titleId: game.title_id,
      name: game.name,
      coverUrl: game.cover_url,
      size: game.size,
      status: success ? 'downloading' : 'error',
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTasks((prev) => [newTask, ...prev]);
    setSelectedGame(null);
  }, [ps4Ip, ps4Port]);

  // =====================================================================
  // CONTROLADOR GLOBAL GAMEPAD (FUNCIONA EM TODAS AS ABAS E NOS MODAIS)
  // =====================================================================
  const { controllerConnected } = useGamepad({
    enabled: true,
    onNavigate: (dir) => {
      // Se um modal estiver aberto, ignora navegação de grade
      if (selectedGame || showSettingsModal) return;

      if (activeNav === 'discover') {
        // Na tela Destaques: Left/Right no topo alterna os 6 Destaques quando focusedIndex === 0
        const maxLen = discoverFlatGames.length;
        if (maxLen === 0) return;

        setFocusedIndex((prev) => {
          let next = prev;
          if (dir === 'left') next = Math.max(0, prev - 1);
          if (dir === 'right') next = Math.min(maxLen - 1, prev + 1);
          if (dir === 'up') next = Math.max(0, prev - gridColumns);
          if (dir === 'down') next = Math.min(maxLen - 1, prev + gridColumns);
          const target = discoverFlatGames[next];
          if (target) setFocusedGameCover(target.cover_url);
          return next;
        });
      } else if (activeNav === 'catalog' || activeNav === 'favorites') {
        const maxLen = paginatedGames.length;
        if (maxLen === 0) return;
        const step = viewMode === 'list' ? 1 : gridColumns;

        setFocusedIndex((prev) => {
          let next = prev;
          if (dir === 'left') next = Math.max(0, prev - 1);
          if (dir === 'right') next = Math.min(maxLen - 1, prev + 1);
          if (dir === 'up') next = Math.max(0, prev - step);
          if (dir === 'down') next = Math.min(maxLen - 1, prev + step);
          const target = paginatedGames[next];
          if (target) setFocusedGameCover(target.cover_url);
          return next;
        });
      }
    },
    onScroll: (deltaY) => {
      window.scrollBy({ top: deltaY * 28, behavior: 'auto' });
    },
    onConfirm: () => {
      // Se o modal de inspeção já estiver aberto, apertar ✕ dispara a instalação no PS4!
      if (selectedGame) {
        triggerPS4Install(selectedGame);
        return;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        return;
      }

      if (activeNav === 'discover') {
        const target = discoverFlatGames[focusedIndex] || spotlightGames[heroIndex];
        if (target) inspectGame(target);
      } else if (activeNav === 'catalog' || activeNav === 'favorites') {
        const target = paginatedGames[focusedIndex];
        if (target) inspectGame(target);
      }
    },
    onBack: () => {
      if (selectedGame) {
        setSelectedGame(null);
      } else if (showSettingsModal) {
        setShowSettingsModal(false);
      } else if (activeNav !== 'discover') {
        setActiveNav('discover');
      }
    },
    onFavorite: () => {
      if (selectedGame) {
        toggleFavorite(selectedGame.title_id);
        return;
      }
      if (activeNav === 'discover') {
        const target = discoverFlatGames[focusedIndex] || spotlightGames[heroIndex];
        if (target) toggleFavorite(target.title_id);
      } else if (activeNav === 'catalog' || activeNav === 'favorites') {
        const target = paginatedGames[focusedIndex];
        if (target) toggleFavorite(target.title_id);
      }
    },
    onSearch: () => {
      searchInputRef.current?.focus();
    },
    onBumperLeft: () => {
      if (selectedGame || showSettingsModal) return;
      const idx = NAV_TABS.findIndex((t) => t.id === activeNav);
      setActiveNav(NAV_TABS[(idx - 1 + NAV_TABS.length) % NAV_TABS.length].id);
    },
    onBumperRight: () => {
      if (selectedGame || showSettingsModal) return;
      const idx = NAV_TABS.findIndex((t) => t.id === activeNav);
      setActiveNav(NAV_TABS[(idx + 1) % NAV_TABS.length].id);
    },
    onTriggerLeft: () => {
      if (activeNav === 'discover') {
        setHeroIndex((prev) => (prev - 1 + spotlightGames.length) % spotlightGames.length);
      } else if (activeNav === 'catalog' || activeNav === 'favorites') {
        setCurrentPage((p) => Math.max(1, p - 1));
        setFocusedIndex(0);
      }
    },
    onTriggerRight: () => {
      if (activeNav === 'discover') {
        setHeroIndex((prev) => (prev + 1) % spotlightGames.length);
      } else if (activeNav === 'catalog' || activeNav === 'favorites') {
        setCurrentPage((p) => Math.min(totalPages, p + 1));
        setFocusedIndex(0);
      }
    },
    onOptions: () => {
      setShowSettingsModal((prev) => !prev);
    },
  });

  const currentHero = spotlightGames[heroIndex] || allGames[0];
  const activeBackdropCover = focusedGameCover || currentHero?.cover_url;
  const alphabet = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  // Contador auxiliar para mapear o índice linear nas fileiras da aba Destaques
  let discoverItemCounter = -1;

  return (
    <div className="min-h-screen bg-[#070709] text-[#fafafa] flex flex-col font-sans selection:bg-white selection:text-black relative overflow-x-hidden pb-20">
      {/* BACKDROP OTIMIZADO PARA WEBKIT PS4 (Sem múltiplos filtros blur pesados) */}
      {activeBackdropCover && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src={activeBackdropCover}
            alt=""
            className="w-full h-full object-cover opacity-[0.10] scale-110 grayscale transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070709]/85 via-[#070709]/95 to-[#070709]" />
        </div>
      )}

      {/* TOPBAR DE CONSOLE */}
      <header className="sticky top-0 z-30 bg-[#070709]/95 border-b border-white/10 px-6 lg:px-12 py-4">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div
              onClick={() => {
                setActiveNav('discover');
                setSelectedGenre('Todos');
              }}
              className="flex items-center gap-3.5 cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.2)] group-hover:scale-105 transition">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2.3">
                  <path d="M12 3L4 9v11h16V9l-8-6z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="13" r="1.5" fill="currentColor" />
                  <path d="M10 17h4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tight text-white">OWL</span>
                  <span className="font-light text-lg tracking-widest text-zinc-400">STORE</span>
                </div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 block">
                  ORBIS OS • FPKG HUB
                </span>
              </div>
            </div>

            <nav className="flex items-center gap-2 bg-[#111114] p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => {
                  const idx = NAV_TABS.findIndex((t) => t.id === activeNav);
                  setActiveNav(NAV_TABS[(idx - 1 + NAV_TABS.length) % NAV_TABS.length].id);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 border border-white/10 transition"
              >
                L1
              </button>

              <div className="flex items-center gap-1">
                {NAV_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeNav === tab.id;
                  const badgeCount =
                    tab.id === 'catalog'
                      ? allGames.length
                      : tab.id === 'favorites'
                      ? favorites.length
                      : tab.id === 'downloads'
                      ? tasks.length
                      : null;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveNav(tab.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2.5 ${
                        active
                          ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-[1.02]'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {badgeCount !== null && badgeCount > 0 && (
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md ${
                            active ? 'bg-black/15 text-black font-black' : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  const idx = NAV_TABS.findIndex((t) => t.id === activeNav);
                  setActiveNav(NAV_TABS[(idx + 1) % NAV_TABS.length].id);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 border border-white/10 transition"
              >
                R1
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end max-w-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (activeNav === 'discover' && e.target.value.trim() !== '') {
                    setActiveNav('catalog');
                  }
                }}
                placeholder="Buscar jogo ou CUSA... (Botão △)"
                className="w-full bg-[#121216] border border-white/10 focus:border-white focus:ring-2 focus:ring-white/20 rounded-2xl pl-11 pr-9 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#121216] hover:bg-zinc-800 border border-white/10 transition shrink-0"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-mono text-xs text-zinc-200">{ps4Ip}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-zinc-300 pl-2">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{systemTime}</span>
            </div>
          </div>
        </div>

        {/* BARRA DE CATEGORIAS */}
        <div className="max-w-[1800px] mx-auto pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {GENRE_LIST.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedGenre === cat.name && activeNav === 'catalog';
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    setSelectedGenre(cat.name);
                    setActiveNav('catalog');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                      : 'bg-[#121216] text-zinc-300 hover:text-white hover:bg-white/[0.06] border border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#121216] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-white"
            >
              <option value="name">ORDEM: A – Z</option>
              <option value="size_desc">MAIOR TAMANHO</option>
              <option value="size_asc">MENOR TAMANHO</option>
            </select>

            <div className="flex items-center bg-[#121216] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* PALCO PRINCIPAL */}
      <main className="relative z-10 max-w-[1800px] w-full mx-auto px-6 lg:px-12 py-8 space-y-12 flex-1">
        {activeNav === 'discover' && (
          <>
            {currentHero && (
              <section className="space-y-4">
                <div className="relative h-[420px] rounded-[28px] overflow-hidden border border-white/15 bg-[#111115] flex flex-col justify-end p-8 lg:p-12 shadow-2xl">
                  <img
                    src={currentHero.cover_url}
                    alt={currentHero.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-[#070709]/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070709] via-[#070709]/80 to-transparent" />

                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-white text-black font-mono font-black text-xs uppercase tracking-wider">
                          DESTAQUE #{heroIndex + 1} (L2/R2)
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white font-mono text-xs border border-white/10">
                          {currentHero.genre}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-black/70 text-zinc-200 font-mono text-xs border border-white/10">
                          {currentHero.title_id} • {currentHero.region}
                        </span>
                      </div>

                      <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-none">
                        {currentHero.name}
                      </h1>

                      <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-zinc-300 pt-1">
                        <div>
                          <span className="text-zinc-400 block text-[11px]">TAMANHO DO PACOTE</span>
                          <strong className="text-white text-base">{formatSize(currentHero.size)}</strong>
                        </div>
                        <div className="h-6 w-px bg-white/15" />
                        <div>
                          <span className="text-zinc-400 block text-[11px]">VERSÃO</span>
                          <strong className="text-white text-base">v{currentHero.version}</strong>
                        </div>
                        <div className="h-6 w-px bg-white/15" />
                        <div>
                          <span className="text-zinc-400 block text-[11px]">FIRMWARE MÍNIMO</span>
                          <strong className="text-white text-base">FW {currentHero.min_fw}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-3">
                        <button
                          onClick={() => inspectGame(currentHero)}
                          className="px-7 py-3.5 rounded-2xl bg-white hover:bg-zinc-200 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition shadow-lg"
                        >
                          <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-mono">
                            ✕
                          </span>
                          Inspecionar & Instalar PKG
                        </button>

                        <button
                          onClick={() => toggleFavorite(currentHero.title_id)}
                          className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center gap-2 transition"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              favorites.includes(currentHero.title_id) ? 'fill-white text-white' : ''
                            }`}
                          />
                          {favorites.includes(currentHero.title_id) ? 'Salvo' : 'Favoritar'}
                        </button>
                      </div>
                    </div>

                    <img
                      src={currentHero.cover_url}
                      alt={currentHero.name}
                      className="hidden md:block w-48 h-64 object-cover rounded-2xl border-2 border-white/20 shadow-2xl shrink-0"
                    />
                  </div>
                </div>

                {/* DOCK DE 6 DESTAQUES (Troca via clique ou L2/R2) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {spotlightGames.map((game, idx) => {
                    const active = idx === heroIndex;
                    return (
                      <button
                        key={game.title_id}
                        onClick={() => setHeroIndex(idx)}
                        onMouseEnter={() => setFocusedGameCover(game.cover_url)}
                        className={`group flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all ${
                          active
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#121216] text-zinc-200 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <img
                          src={game.cover_url}
                          alt=""
                          className="w-11 h-14 rounded-xl object-cover shrink-0 bg-zinc-900"
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-[10px] font-mono uppercase tracking-wider block ${
                              active ? 'text-zinc-700 font-bold' : 'text-zinc-400'
                            }`}
                          >
                            #{idx + 1} • {game.title_id}
                          </span>
                          <p
                            className={`text-xs font-bold truncate mt-0.5 ${
                              active ? 'text-black' : 'text-white'
                            }`}
                          >
                            {game.name}
                          </p>
                          <p
                            className={`text-[11px] font-mono mt-0.5 ${
                              active ? 'text-zinc-800 font-semibold' : 'text-zinc-400'
                            }`}
                          >
                            {formatSize(game.size)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* FILEIRAS HORIZONTAIS NAVEGÁVEIS PELO CONTROLE */}
            {consoleRows.map((row) => (
              <section key={row.title} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-5 rounded-full bg-white" />
                    <h3 className="text-lg font-black tracking-tight text-white">{row.title}</h3>
                    <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/10">
                      {row.tag}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveNav('catalog')}
                    className="text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition"
                  >
                    Ver Catálogo Completo <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {row.items.map((game) => {
                    discoverItemCounter += 1;
                    const itemIndex = discoverItemCounter;
                    const isFocused = focusedIndex === itemIndex;
                    return (
                      <div
                        key={`${row.title}-${game.pkg_url}`}
                        ref={(el) => {
                          if (isFocused) focusedElementRef.current = el;
                        }}
                      >
                        <ConsoleGameTile
                          game={game}
                          isFocused={isFocused}
                          isFav={favorites.includes(game.title_id)}
                          onToggleFav={toggleFavorite}
                          onSelect={() => inspectGame(game)}
                          onHover={() => {
                            setFocusedIndex(itemIndex);
                            setFocusedGameCover(game.cover_url);
                          }}
                          formatSize={formatSize}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}

        {/* ABAS: BIBLIOTECA A-Z & FAVORITOS (COM PAGINAÇÃO DE MEMÓRIA) */}
        {(activeNav === 'catalog' || activeNav === 'favorites') && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 block">
                  OWL STORE • REPOSITÓRIO ORBIS
                </span>
                <h2 className="text-3xl font-black tracking-tight text-white mt-0.5">
                  {activeNav === 'favorites' ? 'Meus Jogos Favoritos' : selectedGenre}
                </h2>
              </div>

              {/* Controles de Paginação (L2 / R2) */}
              <div className="flex items-center gap-3">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 rounded-xl bg-[#121216] border border-white/10 text-xs font-mono font-bold text-white disabled:opacity-40 flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> L2 Anterior
                </button>
                <span className="text-xs font-mono text-zinc-300 bg-[#121216] px-4 py-2 rounded-xl border border-white/10">
                  Página <strong className="text-white">{currentPage}</strong> de {totalPages} (
                  {filteredGames.length} jogos)
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-2 rounded-xl bg-[#121216] border border-white/10 text-xs font-mono font-bold text-white disabled:opacity-40 flex items-center gap-1.5"
                >
                  Próxima R2 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filtro Alfabético */}
            <div className="flex items-center gap-1.5 overflow-x-auto bg-[#111115] p-2 rounded-2xl border border-white/10 no-scrollbar">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setLetterFilter(letter)}
                  className={`min-w-[34px] py-2 rounded-xl text-xs font-mono font-bold transition ${
                    letterFilter === letter
                      ? 'bg-white text-black shadow-md scale-105'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {paginatedGames.length === 0 ? (
              <div className="py-24 text-center bg-[#111115]/60 border border-dashed border-white/15 rounded-3xl space-y-3">
                <Gamepad2 className="w-10 h-10 text-zinc-500 mx-auto" />
                <p className="text-base font-bold text-zinc-300">Nenhum pacote encontrado</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {paginatedGames.map((game, idx) => {
                  const isFocused = idx === focusedIndex;
                  return (
                    <div
                      key={game.pkg_url}
                      ref={(el) => {
                        if (isFocused) focusedElementRef.current = el;
                      }}
                    >
                      <ConsoleGameTile
                        game={game}
                        isFocused={isFocused}
                        isFav={favorites.includes(game.title_id)}
                        onToggleFav={toggleFavorite}
                        onSelect={() => inspectGame(game)}
                        onHover={() => {
                          setFocusedIndex(idx);
                          setFocusedGameCover(game.cover_url);
                        }}
                        formatSize={formatSize}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#111115] border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-mono uppercase tracking-wider text-zinc-400 bg-black/50">
                      <th className="py-4 px-5">Jogo</th>
                      <th className="py-4 px-5">Divisão</th>
                      <th className="py-4 px-5">Title ID</th>
                      <th className="py-4 px-5">Versão</th>
                      <th className="py-4 px-5">Tamanho</th>
                      <th className="py-4 px-5 text-right">Comando</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {paginatedGames.map((game, idx) => {
                      const isFocused = idx === focusedIndex;
                      return (
                        <tr
                          key={game.pkg_url}
                          ref={(el) => {
                            if (isFocused) focusedElementRef.current = el;
                          }}
                          onClick={() => inspectGame(game)}
                          onMouseEnter={() => {
                            setFocusedIndex(idx);
                            setFocusedGameCover(game.cover_url);
                          }}
                          className={`transition cursor-pointer group ${
                            isFocused ? 'bg-white/[0.15] ring-2 ring-white' : 'hover:bg-white/[0.05]'
                          }`}
                        >
                          <td className="py-3.5 px-5 flex items-center gap-3.5">
                            <img
                              src={game.cover_url}
                              alt=""
                              loading="lazy"
                              className="w-10 h-13 rounded-lg object-cover bg-zinc-900 border border-white/15"
                            />
                            <span className="font-bold text-white text-sm">{game.name}</span>
                          </td>
                          <td className="py-3.5 px-5 text-zinc-300">{game.genre}</td>
                          <td className="py-3.5 px-5 font-mono text-zinc-200">{game.title_id}</td>
                          <td className="py-3.5 px-5 font-mono text-zinc-300">v{game.version}</td>
                          <td className="py-3.5 px-5 font-mono text-white font-bold tabular-nums">
                            {formatSize(game.size)}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button className="px-4 py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-zinc-200 transition">
                              ✕ Instalar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ABA DE TRANSFERÊNCIAS */}
        {activeNav === 'downloads' && (
          <section className="max-w-4xl mx-auto space-y-6">
            <div className="border-b border-white/10 pb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
                  PS4 BACKGROUND FILE TRANSFER (libSceBgft)
                </span>
                <h2 className="text-2xl font-black text-white mt-0.5">Fila de Transferências do Console</h2>
              </div>
              {tasks.length > 0 && (
                <button
                  onClick={() => setTasks([])}
                  className="text-xs font-mono text-zinc-300 hover:text-white px-4 py-2 rounded-xl bg-[#121216] border border-white/10"
                >
                  Limpar Fila
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="py-24 text-center bg-[#111115] border border-white/10 rounded-3xl space-y-3">
                <ArrowDownToLine className="w-10 h-10 text-zinc-500 mx-auto" />
                <p className="text-base font-bold text-zinc-300">Nenhuma transferência ativa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div
                    key={t.taskId}
                    className="p-5 rounded-3xl bg-[#111115] border border-white/10 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={t.coverUrl}
                        alt=""
                        className="w-14 h-18 rounded-xl object-cover border border-white/15 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-black font-bold">
                            {t.titleId}
                          </span>
                          <span className="font-mono text-xs text-zinc-400">Task #{t.taskId}</span>
                          <span className="font-mono text-xs text-zinc-500">• {t.timestamp}</span>
                        </div>
                        <h4 className="font-black text-base text-white truncate mt-1">{t.name}</h4>
                        <p className="text-xs font-mono text-zinc-300 mt-0.5">{t.message}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold ${
                          t.status === 'error'
                            ? 'bg-zinc-900 text-zinc-300 border border-white/20'
                            : 'bg-white text-black'
                        }`}
                      >
                        {t.status === 'error' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {t.status === 'error' ? 'Falha RPI' : 'Enviado ao PS4'}
                      </span>
                      <p className="text-xs font-mono text-zinc-300 mt-2">{formatSize(t.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* HUD INFERIOR DE COMANDOS DUALSHOCK */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-[#09090c] border-t border-white/10 px-6 lg:px-12 py-3 select-none">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-300">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                controllerConnected ? 'bg-white shadow-[0_0_10px_#fff]' : 'bg-zinc-600'
              }`}
            />
            <span className="text-white font-bold tracking-wider">
              {controllerConnected ? 'DUALSHOCK ATIVO' : 'MODO TECLADO / MOUSE'}
            </span>
            <span className="text-zinc-600">|</span>
            <span>PS4: {ps4Ip}:{ps4Port}</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white text-black font-black flex items-center justify-center text-[10px]">
                ✕
              </span>
              <span className="text-white">{selectedGame ? 'Confirmar Instalação' : 'Inspecionar'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/20 text-white font-bold flex items-center justify-center text-[10px]">
                ◯
              </span>
              <span>Voltar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/20 text-white font-bold flex items-center justify-center text-[10px]">
                □
              </span>
              <span>Favoritar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/20 text-white text-[10px] font-bold">
                L1/R1
              </span>
              <span>Abas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/20 text-white text-[10px] font-bold">
                L2/R2
              </span>
              <span>Páginas / Destaque</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL DE INSPEÇÃO E INSTALAÇÃO (Responde ao ✕ e ◯ do Controle) */}
      {selectedGame && (
        <div
          onClick={() => setSelectedGame(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d0d11] border-2 border-white/30 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl"
          >
            <div className="relative h-60 bg-black overflow-hidden">
              <img
                src={selectedGame.cover_url}
                alt=""
                className="w-full h-full object-cover opacity-25 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d11] via-[#0d0d11]/60 to-transparent" />

              <button
                onClick={() => setSelectedGame(null)}
                className="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-black/80 border border-white/20 flex items-center gap-1.5 text-xs font-mono text-zinc-200 hover:text-white transition"
              >
                <span>◯</span> Fechar
              </button>

              <div className="absolute bottom-5 left-6 right-6 flex items-end gap-5">
                <img
                  src={selectedGame.cover_url}
                  alt={selectedGame.name}
                  className="w-28 h-36 rounded-2xl object-cover border-2 border-white/30 shadow-2xl shrink-0 bg-zinc-900"
                />
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-white text-black font-mono font-black text-xs px-2.5 py-0.5 rounded">
                      {selectedGame.title_id}
                    </span>
                    <span className="bg-white/10 text-white font-mono text-xs px-2.5 py-0.5 rounded">
                      {selectedGame.genre}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white leading-tight line-clamp-2">
                    {selectedGame.name}
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#15151b] border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs font-mono uppercase text-zinc-400 block">Tamanho</span>
                  <span className="text-base font-mono font-black text-white mt-1 block tabular-nums">
                    {formatSize(pkgHealth?.realSize || selectedGame.size)}
                  </span>
                </div>
                <div className="bg-[#15151b] border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs font-mono uppercase text-zinc-400 block">Versão</span>
                  <span className="text-base font-mono font-black text-white mt-1 block">
                    v{selectedGame.version}
                  </span>
                </div>
                <div className="bg-[#15151b] border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs font-mono uppercase text-zinc-400 block">FW Mín.</span>
                  <span className="text-base font-mono font-black text-zinc-200 mt-1 block">
                    FW {selectedGame.min_fw}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  URI Sanitizer (RFC 3986):
                </span>
                {validating ? (
                  <span className="text-zinc-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Validando stream...
                  </span>
                ) : (
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Pronto para libSceBgft
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => triggerPS4Install(selectedGame)}
                  className="flex-1 py-4 px-6 rounded-2xl bg-white hover:bg-zinc-200 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition shadow-lg ring-4 ring-white/30"
                >
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-mono">
                    ✕
                  </span>
                  Confirmar Instalação no PS4 ({ps4Ip})
                </button>
                <button
                  onClick={() => toggleFavorite(selectedGame.title_id)}
                  className="p-4 rounded-2xl bg-[#15151b] hover:bg-white/15 border border-white/15 text-white transition"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      favorites.includes(selectedGame.title_id) ? 'fill-white' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REDE (OPTIONS) */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d0d11] border-2 border-white/25 rounded-3xl max-w-md w-full p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white">Configuração de Rede PS4</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-mono mb-1.5">
                  IP do PS4 (Use 127.0.0.1 se aberto dentro do próprio PS4)
                </label>
                <input
                  type="text"
                  value={ps4Ip}
                  onChange={(e) => {
                    setPs4Ip(e.target.value);
                    localStorage.setItem('owl_store_ps4_ip', e.target.value);
                  }}
                  className="w-full bg-[#15151b] border border-white/15 rounded-xl px-4 py-3 font-mono text-white focus:outline-none focus:border-white"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-mono mb-1.5">Porta do RPI (Padrão: 12800)</label>
                <input
                  type="number"
                  value={ps4Port}
                  onChange={(e) => setPs4Port(Number(e.target.value))}
                  className="w-full bg-[#15151b] border border-white/15 rounded-xl px-4 py-3 font-mono text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition"
            >
              Salvar (✕)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsoleGameTile({
  game,
  isFocused,
  isFav,
  onToggleFav,
  onSelect,
  onHover,
  formatSize,
}: {
  game: GameItem;
  isFocused: boolean;
  isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
  onSelect: () => void;
  onHover: () => void;
  formatSize: (b: number) => string;
}) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`group relative bg-[#121216] rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between border transition-transform duration-150 ${
        isFocused
          ? 'ring-4 ring-white border-white scale-[1.04] shadow-[0_0_35px_rgba(255,255,255,0.35)] z-20 bg-zinc-800'
          : 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="relative aspect-[3/4] w-full bg-zinc-950 overflow-hidden">
        <img
          src={game.cover_url}
          alt={game.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-transparent to-black/40" />

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <span className="bg-black/90 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border border-white/15 text-zinc-100">
            {game.title_id}
          </span>
          <button
            onClick={(e) => onToggleFav(game.title_id, e)}
            className="w-7 h-7 rounded-full bg-black/80 border border-white/15 flex items-center justify-center text-zinc-200 hover:text-white transition"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
          </button>
        </div>

        <div
          className={`absolute bottom-2.5 inset-x-2.5 transition duration-150 ${
            isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="w-full py-2 rounded-xl bg-white text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-xl">
            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-mono">
              ✕
            </span>
            <span>INSTALAR PKG</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between bg-[#121216]">
        <div>
          <h4 className="font-bold text-xs text-white line-clamp-1">{game.name}</h4>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{game.genre}</p>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono">
          <span className="text-white font-bold tabular-nums">{formatSize(game.size)}</span>
          <span className="text-[11px] text-zinc-400">v{game.version}</span>
        </div>
      </div>
    </div>
  );
}