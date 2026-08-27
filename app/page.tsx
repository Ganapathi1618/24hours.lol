import { Marketplace } from '@/components/Marketplace';
import { loadBoard } from '@/lib/board';
import type { HourSlot } from '@/lib/types';

// The board is live data — never statically cached.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let hours: HourSlot[] | null = null;

  try {
    const board = await loadBoard();
    hours = board.hours;
  } catch (error) {
    // Render the clock anyway; the board section shows its own retry state.
    console.error('[page] initial board load failed', error);
  }

  return (
    <main>
      <Marketplace initialHours={hours} serverTime={new Date().toISOString()} />
    </main>
  );
}
