"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Aktif grubu değiştirir ve kişiyi o gruptaki rolüne uygun ana ekrana gönderir. */
export async function grupSec(formData: FormData) {
  const grup = String(formData.get("grup") ?? "");
  if (!grup) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("spor_grup_sec", { p_grup: grup });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/git");
}
