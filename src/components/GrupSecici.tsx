"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { grupSec } from "@/app/grup/actions";
import type { Grubum } from "@/lib/grup";
import { rolAdi } from "@/lib/roller";

function Secim({ gruplar, secili, koyu }: { gruplar: Grubum[]; secili: string; koyu?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <select
      name="grup"
      defaultValue={secili}
      aria-label="Grup"
      disabled={pending}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={`w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl border px-3 py-2 pr-8 text-sm font-bold disabled:opacity-60 ${
        koyu
          ? "border-white/10 bg-white/[0.06] text-white"
          : "border-neutral-200 bg-white text-neutral-900"
      }`}
      style={{
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 15px) 55%, calc(100% - 10px) 55%",
        backgroundSize: "5px 5px, 5px 5px",
        backgroundRepeat: "no-repeat",
      }}
    >
      {gruplar.map((g) => (
        <option key={g.id} value={g.id} className="text-neutral-900">
          {g.ad}
          {g.aktif ? "" : " (pasif)"} · {rolAdi(g.rol)}
        </option>
      ))}
    </select>
  );
}

/**
 * Grup seçici: birden çok gruba erişen kişiye (admin, kulüp başkanı, iki grupta görevli
 * personel, iki grupta çocuğu olan veli) görünür. Seçince sayfa o grubun verisiyle açılır.
 */
export default function GrupSecici({
  gruplar,
  gorunum,
}: {
  gruplar: Grubum[];
  gorunum: "yan" | "ust";
}) {
  const form = useRef<HTMLFormElement>(null);
  if (gruplar.length < 2) return null;
  const secili = (gruplar.find((g) => g.secili) ?? gruplar[0]).id;

  if (gorunum === "yan") {
    return (
      <form ref={form} action={grupSec} className="px-4 pb-4">
        <p className="bolum-basligi mb-1.5 px-1">Grup</p>
        <Secim gruplar={gruplar} secili={secili} koyu />
      </form>
    );
  }

  return (
    <form
      ref={form}
      action={grupSec}
      className="flex items-center gap-2 bg-siyah px-4 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] print:hidden lg:hidden"
    >
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-yesil-500">Grup</span>
      <div className="min-w-0 flex-1">
        <Secim gruplar={gruplar} secili={secili} koyu />
      </div>
    </form>
  );
}
