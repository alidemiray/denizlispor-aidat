/* Hafif, bağımlılıksız SVG grafikler.
   Tek seri kullanılır (çift eksen yok), ince işaretler, geri planda ızgara,
   seçici etiket; her işaretin üstüne gelince <title> ile değer görünür. */

const YESIL = "var(--marka)";
const YESIL_ACIK = "var(--marka-soluk)";
const IZGARA = "var(--izgara)";
const YAZI = "var(--grafik-yazi)";

export function SutunGrafik({
  veri,
  birim = "",
  yukseklik = 150,
  vurgu,
}: {
  veri: { etiket: string; deger: number; ipucu?: string }[];
  birim?: string;
  yukseklik?: number;
  vurgu?: number;
}) {
  if (veri.length === 0) return null;
  const G = 320;
  const Y = yukseklik;
  const ustBosluk = 14;
  const altBosluk = 22;
  const alan = Y - ustBosluk - altBosluk;
  const enBuyuk = Math.max(...veri.map((v) => v.deger), 1);
  const adim = G / veri.length;
  const genislik = Math.min(26, adim * 0.56);

  return (
    <svg viewBox={`0 0 ${G} ${Y}`} className="h-auto w-full" role="img">
      {[0, 0.5, 1].map((o) => (
        <line
          key={o}
          x1={0}
          x2={G}
          y1={ustBosluk + alan * o}
          y2={ustBosluk + alan * o}
          stroke={IZGARA}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {veri.map((v, i) => {
        const h = Math.max(2, (v.deger / enBuyuk) * alan);
        const x = i * adim + (adim - genislik) / 2;
        const y = ustBosluk + alan - h;
        const sonuncu = vurgu === undefined ? i === veri.length - 1 : i === vurgu;
        return (
          <g key={`${v.etiket}-${i}`}>
            <title>{v.ipucu ?? `${v.etiket}: ${v.deger}${birim}`}</title>
            <rect
              x={x}
              y={y}
              width={genislik}
              height={h}
              rx={4}
              fill={sonuncu ? YESIL : "var(--marka-yari)"}
            />
            <text
              x={i * adim + adim / 2}
              y={Y - 7}
              textAnchor="middle"
              fontSize={9}
              fill={YAZI}
              fontWeight={600}
            >
              {v.etiket}
            </text>
            {sonuncu ? (
              <text
                x={i * adim + adim / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                fill={YESIL}
                fontWeight={700}
              >
                {v.deger}
                {birim}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function CizgiGrafik({
  veri,
  enAz,
  enCok,
  birim = "",
  yukseklik = 160,
}: {
  veri: { etiket: string; deger: number }[];
  enAz?: number;
  enCok?: number;
  birim?: string;
  yukseklik?: number;
}) {
  if (veri.length === 0) return null;
  const G = 320;
  const Y = yukseklik;
  const sol = 6;
  const sag = 6;
  const ust = 16;
  const alt = 24;
  const alan = Y - ust - alt;
  const genislik = G - sol - sag;

  const degerler = veri.map((v) => v.deger);
  const min = enAz ?? Math.min(...degerler);
  const max = enCok ?? Math.max(...degerler);
  const araliq = max - min || 1;

  const nokta = (i: number, d: number) => {
    const x = veri.length === 1 ? sol + genislik / 2 : sol + (i / (veri.length - 1)) * genislik;
    const y = ust + alan - ((d - min) / araliq) * alan;
    return [x, y] as const;
  };

  const cizgi = veri.map((v, i) => nokta(i, v.deger).join(",")).join(" ");
  const ilk = nokta(0, veri[0].deger);
  const son = nokta(veri.length - 1, veri[veri.length - 1].deger);
  const dolgu = `${sol},${ust + alan} ${cizgi} ${son[0]},${ust + alan}`;

  return (
    <svg viewBox={`0 0 ${G} ${Y}`} className="h-auto w-full" role="img">
      {[0, 0.5, 1].map((o) => (
        <line
          key={o}
          x1={sol}
          x2={G - sag}
          y1={ust + alan * o}
          y2={ust + alan * o}
          stroke={IZGARA}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {veri.length > 1 ? <polygon points={dolgu} fill={YESIL_ACIK} /> : null}
      <polyline
        points={cizgi}
        fill="none"
        stroke={YESIL}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {veri.map((v, i) => {
        const [x, y] = nokta(i, v.deger);
        const sonuncu = i === veri.length - 1;
        return (
          <g key={`${v.etiket}-${i}`}>
            <title>{`${v.etiket}: ${v.deger}${birim}`}</title>
            <circle cx={x} cy={y} r={sonuncu ? 5 : 4} fill="#FFFFFF" stroke={YESIL} strokeWidth={2} />
            {i === 0 || sonuncu || veri.length <= 4 ? (
              <text x={x} y={Y - 8} textAnchor="middle" fontSize={9} fill={YAZI} fontWeight={600}>
                {v.etiket}
              </text>
            ) : null}
            {sonuncu ? (
              <text x={x} y={y - 9} textAnchor="middle" fontSize={10} fill={YESIL} fontWeight={700}>
                {v.deger}
                {birim}
              </text>
            ) : null}
          </g>
        );
      })}
      <title>{`${veri[0].etiket} → ${veri[veri.length - 1].etiket}`}</title>
      <desc>{`İlk değer ${ilk ? veri[0].deger : ""}${birim}`}</desc>
    </svg>
  );
}

export function YatayBarGrafik({
  veri,
  enCok = 10,
}: {
  veri: { etiket: string; deger: number | null }[];
  enCok?: number;
}) {
  const gecerli = veri.filter((v) => v.deger !== null) as { etiket: string; deger: number }[];
  if (gecerli.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {gecerli.map((v) => (
        <div key={v.etiket} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs font-medium text-neutral-600">{v.etiket}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-yesil-500"
              style={{ width: `${Math.round((v.deger / enCok) * 100)}%` }}
              title={`${v.etiket}: ${v.deger}/${enCok}`}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-bold text-neutral-900">
            {v.deger}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HalkaGrafik({
  yuzde,
  altYazi,
  boyut = 116,
  baslik = "Devam oranı",
}: {
  yuzde: number;
  altYazi?: string;
  boyut?: number;
  baslik?: string;
}) {
  const r = 46;
  const cevre = 2 * Math.PI * r;
  const dolu = (Math.min(100, Math.max(0, yuzde)) / 100) * cevre;

  return (
    <div className="flex flex-col items-center" style={{ width: boyut }}>
      <svg viewBox="0 0 110 110" style={{ width: boyut, height: boyut }} role="img">
        <title>{`${baslik} %${Math.round(yuzde)}`}</title>
        <circle cx="55" cy="55" r={r} fill="none" stroke={IZGARA} strokeWidth={9} />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={YESIL}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${dolu} ${cevre - dolu}`}
          transform="rotate(-90 55 55)"
        />
        <text
          x="55"
          y="58"
          textAnchor="middle"
          fontSize="24"
          fontWeight="800"
          fill="#FFFFFF"
        >
          %{Math.round(yuzde)}
        </text>
      </svg>
      {altYazi ? (
        <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">{altYazi}</p>
      ) : null}
    </div>
  );
}
