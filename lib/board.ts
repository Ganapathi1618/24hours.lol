import 'server-only';

import { buildBoard, currentUtcHour } from './hours';
import { getReadClient } from './supabase/read';
import type { HourRow, HoursResponse } from './types';

export class BoardUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardUnavailableError';
  }
}

/** Read every hour row and expand it into the full 24-slot board. */
export async function loadBoard(): Promise<HoursResponse> {
  const supabase = getReadClient();
  if (!supabase) {
    throw new BoardUnavailableError('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('hours')
    .select('*')
    .order('hour_number', { ascending: true });

  if (error) {
    console.error('[board] failed to read hours', error);
    throw new BoardUnavailableError(error.message);
  }

  return {
    hours: buildBoard((data ?? []) as HourRow[]),
    current_hour: currentUtcHour(),
    server_time: new Date().toISOString(),
  };
}
