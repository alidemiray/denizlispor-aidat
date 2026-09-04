import { gecikmisMi } from "@/lib/format";

export function AidatRozeti({
  durum,
  sonOdeme,
}: {
  durum: string;
  sonOdeme: string | null;
}) {
  if (durum === "odendi")
    return <span className="rozet bg-emerald-100 text-emerald-800">Ödendi</span>;
  if (durum === "muaf")
    return <span className="rozet bg-neutral-200 text-neutral-700">Muaf</span>;
  if (gecikmisMi(sonOdeme, durum))
    return <span className="rozet bg-red-100 text-red-800">Gecikmiş</span>;
  return <span className="rozet bg-amber-100 text-amber-900">Bekliyor</span>;
}

export function OdemeRozeti({ durum }: { durum: string }) {
  if (durum === "onaylandi")
    return <span className="rozet bg-emerald-100 text-emerald-800">Onaylandı</span>;
  if (durum === "reddedildi")
    return <span className="rozet bg-red-100 text-red-800">Reddedildi</span>;
  return <span className="rozet bg-amber-100 text-amber-900">Onay bekliyor</span>;
}
