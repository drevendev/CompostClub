import type { CSSProperties } from 'react';
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<string, string> = {
    leaf: 'M12 21v-9M12 15C4 16 2 9 3 4c8-1 12 4 9 11M12 10c0-7 6-9 10-8 1 7-4 12-10 8',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
    upload: 'M12 16V4M7 9l5-5 5 5M4 17v4h16v-4',
    close: 'M6 6l12 12M18 6 6 18',
    clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    settings: 'M4 7h16M4 17h16M9 4v6M15 14v6',
    sprout: 'M12 22V11M12 15C3 16 2 9 3 6c7-1 11 2 9 9M12 11c0-7 6-10 10-9 1 7-4 12-10 9',
    lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
    check: 'M5 12l4 4L20 5',
    edit: 'm15 4 5 5M4 20l4-1L21 6l-5-5L3 14z',
    cycle: 'M4 8a8 8 0 0 1 14-3l3 3M21 3v5h-5M20 16a8 8 0 0 1-14 3l-3-3M3 21v-5h5',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    book: 'M12 5v16M12 5C8 2 3 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-2-7-1-10 1',
    expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
    info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.leaf} />
    </svg>
  );
}
