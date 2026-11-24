import { benchPreference } from './web-bench';

export type Look = 'ios' | 'android';

/** The bench draws either platform's conventions, chosen with its "Plateforme" control. */
export const look: Look = benchPreference('look') === 'android' ? 'android' : 'ios';
