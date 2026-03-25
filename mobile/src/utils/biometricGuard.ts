/** Shared flag — set true while a system picker (document, image, share sheet) is open
 *  so the biometric lock doesn't trigger on return. */
let _suppressed = false;

export const biometricGuard = {
  suppress: () => { _suppressed = true; },
  resume: () => { _suppressed = false; },
  isSuppressed: () => _suppressed,
};
