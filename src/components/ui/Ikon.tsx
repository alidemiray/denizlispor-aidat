type Props = { ad: IkonAdi; className?: string };

export type IkonAdi =
  | "ev" | "kisiler" | "takvim" | "cuzdan" | "grafik" | "daha"
  | "pano" | "futbol" | "ayar" | "cikis" | "belge" | "kalem"
  | "kontrol" | "arsiv" | "kalkan" | "artı";

const YOLLAR: Record<IkonAdi, React.ReactNode> = {
  ev: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />,
  kisiler: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c0-3.2 2.8-5.2 6.2-5.2s6.2 2 6.2 5.2" />
      <path d="M16.5 6.4a3 3 0 0 1 0 5.6M18 20c0-2.2-.7-3.9-2-5" />
    </>
  ),
  takvim: (
    <>
      <rect x="3.2" y="5" width="17.6" height="16" rx="3" />
      <path d="M3.2 10h17.6M8 3v4M16 3v4" />
    </>
  ),
  cuzdan: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M16.2 12.2h1.6" />
    </>
  ),
  grafik: <path d="M4 19V9M9.7 19V5M15.3 19v-6M21 19v-9" />,
  daha: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  pano: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2.6" />
      <path d="M9 4.5V3.4h6v1.1M9 10h6M9 14h4" />
    </>
  ),
  futbol: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m12 7.6 3.6 2.6-1.4 4.3H9.8L8.4 10.2z" />
    </>
  ),
  ayar: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.2v2.2M12 18.6v2.2M20.8 12h-2.2M5.4 12H3.2M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8" />
    </>
  ),
  cikis: <path d="M14.5 8V5.8A1.8 1.8 0 0 0 12.7 4H6.3A1.8 1.8 0 0 0 4.5 5.8v12.4A1.8 1.8 0 0 0 6.3 20h6.4a1.8 1.8 0 0 0 1.8-1.8V16M10 12h10m0 0-3-3m3 3-3 3" />,
  belge: (
    <>
      <path d="M6 3.6h7.5L19 9v11.4H6z" />
      <path d="M13.2 3.6V9H19M9 13h6M9 16.5h4" />
    </>
  ),
  kalem: <path d="M4 20h4L19.2 8.8a2.1 2.1 0 0 0 0-3L18.2 4.8a2.1 2.1 0 0 0-3 0L4 16z" />,
  kontrol: <path d="m5 12.5 4.6 4.5L19 7.5" />,
  arsiv: (
    <>
      <rect x="3.4" y="4.5" width="17.2" height="4.4" rx="1.4" />
      <path d="M5.2 8.9V19h13.6V8.9M10 12.6h4" />
    </>
  ),
  kalkan: <path d="M12 3.4 5 6.2v5.3c0 4 2.9 7.6 7 9.1 4.1-1.5 7-5.1 7-9.1V6.2z" />,
  artı: <path d="M12 5.5v13M5.5 12h13" />,
};

export default function Ikon({ ad, className = "h-6 w-6" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {YOLLAR[ad]}
    </svg>
  );
}
