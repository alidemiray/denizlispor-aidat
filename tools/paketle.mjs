// Projeyi tek bir sıkıştırılmış dosyaya paketler.
// Amaç: Vercel'e dağıtım sırasında onlarca kaynak dosyayı tek bir yük olarak taşımak.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const kok = path.resolve(process.argv[2] ?? ".");
const atla = new Set(["node_modules", ".next", ".git", "tools"]);
const kokDosyalari = new Set(["package.json", "unpack.js", "payload.b64", "README.md", ".gitignore"]);
const metinUzantilari = new Set([".ts", ".tsx", ".css", ".mjs", ".js", ".json", ".webmanifest"]);

const dosyalar = {};

function gez(dizin) {
  for (const girdi of fs.readdirSync(dizin, { withFileTypes: true })) {
    if (atla.has(girdi.name)) continue;
    const tam = path.join(dizin, girdi.name);
    const göreli = path.relative(kok, tam).split(path.sep).join("/");
    if (girdi.isDirectory()) {
      gez(tam);
      continue;
    }
    if (kokDosyalari.has(göreli)) continue;
    const veri = fs.readFileSync(tam);
    const uzanti = path.extname(girdi.name);
    dosyalar[göreli] = metinUzantilari.has(uzanti)
      ? { t: veri.toString("utf8") }
      : { b: veri.toString("base64") };
  }
}

gez(kok);

const ham = Buffer.from(JSON.stringify(dosyalar), "utf8");
const sikistirilmis = zlib.gzipSync(ham, { level: 9 });
const cikti = sikistirilmis.toString("base64");
fs.writeFileSync(path.join(kok, "payload.b64"), cikti);

console.log(
  `dosya: ${Object.keys(dosyalar).length}  ham: ${ham.length}  gzip: ${sikistirilmis.length}  base64: ${cikti.length}`,
);
console.log(Object.keys(dosyalar).sort().join("\n"));
