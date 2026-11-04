import type { ComponentChildren } from 'preact';

const Svg = ({ children, size = 20 }: { children: ComponentChildren; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{children}</svg>
);

export const IconSearch = () => <Svg><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>;
export const IconClose = () => <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconGrid = () => <Svg><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>;
export const IconList = () => <Svg><rect x="4" y="5" width="6" height="5" rx="1.2" /><rect x="4" y="14" width="6" height="5" rx="1.2" /><path d="M13 7.5h7M13 16.5h7" /></Svg>;
export const IconRefresh = () => <Svg><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L20 9.3" /><path d="M20 4.5v4.8h-4.8" /></Svg>;
export const IconGear = () => <Svg><circle cx="12" cy="12" r="2.8" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></Svg>;
export const IconHelp = () => <Svg><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8" /><path d="M12 16.8v.1" /></Svg>;
export const IconTrash = () => <Svg size={18}><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.500 7M10 11v4.500M14 11v4.500" /></Svg>;
export const IconAdd = () => <Svg size={18}><path d="M4 7h11M4 12h8M4 17h6M17 12v8M13 16h8" /></Svg>;
export const IconNote = () => <Svg size={18}><path d="M5 4.500h14v10l-5 5H5z" /><path d="M14 19.500v-5h5M8.500 9h7M8.500 13h3.500" /></Svg>;
export const IconTag = () => <Svg size={18}><path d="M4 4.500h7.500l8.500 8.500-7 7-8.500-8.500z" /><circle cx="8.500" cy="9" r="1.200" /></Svg>;
export const IconPlay = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.200v13.600a.8.8 0 0 0 1.200.7l11-6.800a.8.8 0 0 0 0-1.400l-11-6.800A.8.8 0 0 0 8 5.200z" /></svg>;
export const IconTop = () => <Svg size={18}><path d="M5 5h14M12 20V9M7.500 13.500 12 9l4.500 4.500" /></Svg>;
export const IconBottom = () => <Svg size={18}><path d="M5 19h14M12 4v11M7.500 10.500 12 15l4.500-4.500" /></Svg>;
export const IconCheck = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8.500 3.200 3.200L13 4.800" /></svg>;
export const IconMinus = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" aria-hidden="true"><path d="M3.500 8h9" /></svg>;
export const IconChevron = () => <Svg size={16}><path d="m7 10 5 5 5-5" /></Svg>;
export const IconMore = () => <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.400" /><circle cx="8" cy="8" r="1.400" /><circle cx="13" cy="8" r="1.400" /></svg>;
export const IconPlus = () => <Svg size={16}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconFilter = () => <Svg><path d="M4 7h16M7.500 12h9M10.500 17h3" /></Svg>;
export const IconBroken = () => <Svg size={28}><rect x="3.500" y="5.500" width="17" height="13" rx="2" /><path d="m4 5 16 14" /></Svg>;
export const IconArrowExit = () => <Svg size={18}><path d="M4 6h16v12H4zM4 10h16" /></Svg>;
