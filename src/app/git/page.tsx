import { redirect } from "next/navigation";
import { anaEkran, oturum } from "@/lib/yetki";

export const dynamic = "force-dynamic";

/** Açılış ekranından sonra kişiyi rolüne uygun ana ekrana gönderir. */
export default async function Yonlendir() {
  const { rol } = await oturum();
  redirect(anaEkran(rol));
}
