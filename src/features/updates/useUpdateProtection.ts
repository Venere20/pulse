import { useEffect } from 'react';
import { updateProtection } from './updateProtection';
/** A retained screen can still own unsaved work while another route is visible. */
export function useUpdateProtection(blocked: boolean) {
  useEffect(() => { if (blocked) return updateProtection.hold(); }, [blocked]);
}
