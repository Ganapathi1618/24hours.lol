import { NextResponse } from 'next/server';

import { BoardUnavailableError, loadBoard } from '@/lib/board';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const board = await loadBoard();
    return NextResponse.json(board, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message =
      error instanceof BoardUnavailableError
        ? 'The board is temporarily unavailable.'
        : 'Unexpected error loading the board.';
    console.error('[api/hours]', error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
