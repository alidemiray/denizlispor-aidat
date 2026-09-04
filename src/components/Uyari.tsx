export default function Uyari({
  tip = "hata",
  children,
}: {
  tip?: "hata" | "basari" | "bilgi";
  children: React.ReactNode;
}) {
  const stil =
    tip === "hata"
      ? "bg-red-50 text-red-800 ring-red-600/15"
      : tip === "basari"
        ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
        : "bg-amber-50 text-amber-900 ring-amber-600/15";
  return (
    <div className={`rounded-xl px-3.5 py-3 text-sm leading-relaxed ring-1 ${stil}`}>
      {children}
    </div>
  );
}
