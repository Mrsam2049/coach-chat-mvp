import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KB_DIR = process.env.KB_DIR || "kb";
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID; // usa el tuyo vs_...

async function main() {
  if (!VECTOR_STORE_ID) {
    throw new Error("Falta OPENAI_VECTOR_STORE_ID en tu .env (vs_...)");
  }

  // 1) Buscar PDFs
  const filePaths = fs
    .readdirSync(KB_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(KB_DIR, f));

  if (!filePaths.length) {
    console.log(`⚠️ No encontré PDFs en "${KB_DIR}"`);
    return;
  }

  console.log("✅ Vector store:", VECTOR_STORE_ID);
  console.log("⬆️ Subiendo archivos a OpenAI (files.create)...");

  // 2) Subir archivos y obtener file_ids
  const fileIds = [];
  for (const p of filePaths) {
    console.log(" -", p);

    const uploaded = await client.files.create({
      file: fs.createReadStream(p),
      purpose: "assistants" // purpose usado por file_search/vector stores
    });

    fileIds.push(uploaded.id);
    console.log("   ✅ file_id:", uploaded.id);
  }

  // 3) Crear batch en el vector store con esos file_ids y esperar procesamiento
  console.log("📦 Creando batch en vector store...");
  const batch = await client.vectorStores.fileBatches.createAndPoll(
    VECTOR_STORE_ID,
    { file_ids: fileIds }
  );

  console.log("✅ Batch status:", batch.status);
  console.log("✅ File counts:", batch.file_counts);
  console.log("\n🎉 Listo. Vector store ID:");
  console.log(VECTOR_STORE_ID);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});