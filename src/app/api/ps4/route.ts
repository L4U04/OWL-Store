// src/app/api/ps4/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface PS4CommandPayload {
  action: 'install' | 'is_exists' | 'get_task_progress' | 'validate_pkg';
  ps4Ip: string;
  ps4Port?: number;
  packages?: string[];
  titleId?: string;
  taskId?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: PS4CommandPayload = await req.json();
    const { action, ps4Ip, ps4Port = 12800, packages = [], titleId, taskId } = body;

    // 1. Pré-validação HTTP HEAD no servidor de arquivos (Evita erro 99% da libSceBgft)
    if (action === 'validate_pkg' && packages.length > 0) {
      const targetUrl = packages[0];
      const headRes = await fetch(targetUrl, { method: 'HEAD', cache: 'no-store' });

      return NextResponse.json({
        online: headRes.ok,
        status: headRes.status,
        realSizeBytes: Number(headRes.headers.get('content-length') || 0),
        acceptRanges: headRes.headers.get('accept-ranges') === 'bytes',
      });
    }

    if (!ps4Ip) {
      return NextResponse.json({ error: 'IP do PS4 não informado.' }, { status: 400 });
    }

    const baseRpiUrl = `http://${ps4Ip}:${ps4Port}/api`;

    // 2. Verifica se o pacote já está instalado no PS4
    if (action === 'is_exists' && titleId) {
      const response = await fetch(`${baseRpiUrl}/is_exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title_id: titleId }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await response.json();
      return NextResponse.json(data);
    }

    // 3. Envia fila de pacotes (Base, Update, DLC) para a libSceBgft via RPI
    if (action === 'install' && packages.length > 0) {
      const response = await fetch(`${baseRpiUrl}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          packages: packages, // O RPI aceita array sequencial de URLs diretas
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    // 4. Consulta o progresso em tempo real da Task na libSceBgft
    if (action === 'get_task_progress' && typeof taskId === 'number') {
      const response = await fetch(`${baseRpiUrl}/get_task_progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
        signal: AbortSignal.timeout(4000),
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'fail',
        error: err?.message || 'Falha ao conectar com o PS4 na rede local.',
      },
      { status: 502 }
    );
  }
}