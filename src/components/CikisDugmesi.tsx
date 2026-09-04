export default function CikisDugmesi() {
  return (
    <form action="/cikis" method="post">
      <button
        type="submit"
        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
      >
        Çıkış
      </button>
    </form>
  );
}
