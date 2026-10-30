import type { Stroke } from '../canvas/protocol';
import { sameJSON } from '../../state/dataStore';

/** Retain the unchanged prefix; transmit only the changed/new suffix. Undo is
 * represented by a shorter keep_count and an empty suffix. */
export function drawingPatch(before: Stroke[], after: Stroke[], revision: number) {
  let keep = 0;
  while (keep < before.length && keep < after.length && sameJSON(before[keep], after[keep])) keep++;
  if (keep === before.length && keep === after.length) return null;
  return { drawing_revision: revision, keep_count: keep, strokes: after.slice(keep).map(stroke => ({ ...stroke, points: [...stroke.points] })) };
}
