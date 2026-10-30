export type PulseType = 'thinking' | 'coffee' | 'miss_you' | 'urgent';

export interface MoodOption {
  id: PulseType;
  emoji: string;
  label: string;
  color: string;
}

export interface PulseLog {
  id: string;
  sender_id: string;
  type: PulseType;
  created_at: string;
  message?: string | null;
  reply_to?: string | null;
}

export const PULSE_MESSAGE_MAX = 140;
