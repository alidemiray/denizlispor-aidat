"use client";

import { useFormStatus } from "react-dom";

export default function KaydetDugmesi({
  children,
  bekleyen = "Kaydediliyor…",
  className = "btn-birincil w-full",
}: {
  children: React.ReactNode;
  bekleyen?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? bekleyen : children}
    </button>
  );
}
