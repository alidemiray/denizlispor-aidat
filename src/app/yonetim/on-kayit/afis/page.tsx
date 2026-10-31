import Image from "next/image";
import QRCode from "qrcode";
import YazdirDugmesi from "@/components/YazdirDugmesi";
import GeriDugmesi from "@/components/GeriDugmesi";
import { yoneticiGerekli } from "@/lib/yetki";
import { gruplarim, seciliGrup } from "@/lib/grup";
import { KULUP, KULUP_MANSET } from "@/kulup";

export const dynamic = "force-dynamic";

/** A4 dikey ön kayıt afişi: yazdırılır ya da PDF kaydedilir. Kulüp renkleri yapılandırmadan gelir. */
export default async function Afis() {
  const { supabase } = await yoneticiGerekli();
  // Birden çok grup varsa her grubun kendi başvuru bağlantısı / QR'ı olur
  const gruplar = await gruplarim(supabase);
  const grup = gruplar.length > 1 ? seciliGrup(gruplar) : null;
  const baglanti = `${KULUP.yayin.adres.replace(/\/$/, "")}/basvuru${grup ? `?grup=${grup.kod}` : ""}`;
  const qr = await QRCode.toString(baglanti, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#FFFFFF" },
  });

  return (
    <main className="min-h-dvh bg-zemin px-4 py-6 print:bg-[#FFFFFF] print:p-0">
      <style>{`@page { size: A4 portrait; margin: 0 } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[420px] items-center gap-3 print:hidden">
        <GeriDugmesi hedef="/yonetim/on-kayit" />
        <div className="flex-1">
          <YazdirDugmesi etiket="Afişi yazdır / PDF kaydet" />
        </div>
      </div>

      <article
        className="relative mx-auto flex aspect-[210/297] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-siyah text-white shadow-2xl print:h-[297mm] print:w-[210mm] print:max-w-none print:rounded-none print:shadow-none"
      >
        <div aria-hidden className="absolute -right-[18%] -top-[12%] h-[62%] w-[62%] rounded-full border-[3px] border-yesil-500/30" />
        <div aria-hidden className="absolute -right-[6%] top-[2%] h-[34%] w-[34%] rounded-full border-2 border-yesil-500/20" />
        <div aria-hidden className="absolute -bottom-[8%] -left-[10%] h-[34%] w-[34%] rounded-full bg-yesil-500/90" />

        <header className="relative flex items-center gap-[3%] px-[8%] pt-[9%]">
          <Image src={KULUP.arma} unoptimized={KULUP.arma.endsWith(".svg")} alt="" width={64} height={64} className="h-auto w-[15%]" />
          <div>
            <p className="manset text-[clamp(16px,5.2vw,26px)] print:text-[26pt]">{KULUP_MANSET}</p>
            <p className="font-mono text-[clamp(7px,2vw,10px)] tracking-[0.18em] text-yesil-500 print:text-[9pt]">
              ALTYAPI · {KULUP.sehir.toLocaleUpperCase("tr-TR")}
            </p>
          </div>
        </header>

        <section className="relative mt-[9%] px-[8%]">
          <p className="font-mono text-[clamp(8px,2.4vw,12px)] tracking-[0.16em] text-yesil-500 print:text-[11pt]">{grup ? `${grup.ad.toLocaleUpperCase("tr-TR")} · ` : ""}ÖN KAYIT AÇIK</p>
          <h1 className="manset mt-[2%] text-[clamp(40px,14vw,72px)] leading-[0.88] print:text-[64pt]">
            Sahaya
            <br />
            ilk adım
          </h1>
          <p className="mt-[4%] max-w-[85%] text-[clamp(11px,3.3vw,16px)] leading-snug text-white/80 print:text-[14pt]">
            Kodu telefonunuzla okutun, veli hesabınızı açın, çocuğunuzu kaydedin. Deneme dersi için sizi biz arayalım.
          </p>
        </section>

        <section className="relative mt-auto flex items-end gap-[6%] px-[8%] pb-[9%]">
          <div className="w-[42%] rounded-[6%] bg-[#FFFFFF] p-[3%]">
            <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <ol className="flex-1 space-y-[6%] pb-[2%] text-[clamp(9px,2.7vw,13px)] print:text-[12pt]">
            {["Kodu okut", "Hesabını aç", "Çocuğunu kaydet", "Deneme dersine gel"].map((m, i) => (
              <li key={m} className="flex items-center gap-[6%]">
                <span className="flex aspect-square w-[16%] shrink-0 items-center justify-center rounded-full bg-yesil-500 font-manset font-extrabold text-anametin">
                  {i + 1}
                </span>
                <span className="font-semibold">{m}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="relative border-t border-white/10 px-[8%] py-[3.5%]">
          <p className="break-all font-mono text-[clamp(7px,2vw,10px)] text-white/60 print:text-[9pt]">{baglanti}</p>
        </footer>
      </article>
    </main>
  );
}
