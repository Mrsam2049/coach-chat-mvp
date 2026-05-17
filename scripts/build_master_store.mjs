/**
 * Aurora — Construye UN vector store maestro con TODO el conocimiento.
 *
 * Reutiliza los file-… que ya están subidos en OpenAI (no re-sube PDFs).
 * Crea un store nuevo "Aurora KB completa", adjunta los 10 archivos,
 * espera a que indexen e imprime el ID para ponerlo en OPENAI_VECTOR_STORE_ID.
 *
 * Uso:  node scripts/build_master_store.mjs
 */

import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const vs = client.vectorStores ?? client.beta?.vectorStores;

if (!vs) {
  console.error('❌  Instala/actualiza: npm install openai@latest');
  process.exit(1);
}

// Mismos file-IDs que ya usa upload_kb_modulos.mjs (ya están en OpenAI).
const FILE_IDS = [
  'file-DDsfHhdneoG9s7ASxHDGsH', // primeros_pasos
  'file-93ruBHtXTL52PvzD7cPAoA', // conocer_la_mente
  'file-HSbb9GQ8Rt3icC5ukyQ8TD', // hipnosis
  'file-ST4mCptpvRmXaL12zBAABp', // apego
  'file-VSf3JCb4bhe89sJCuQp7C7', // invitados_especiales (sexóloga, etc.)
  'file-MNr71p9D9cYF9gMmGusTQY', // sensualidad
  'file-BB8wN4nS9vKvtMwPDJkvE4', // geishas
  'file-L91V61QXHXe6dmeRDdzRff', // estrategia
  'file-9UF5vXpzieGhSGjzS9cJm6', // detectar_hombre
  'file-C5L6shjSNSWtuyFgXCCJ7R', // neuropsicologia
];

const CHUNKING = {
  type: 'static',
  static: { max_chunk_size_tokens: 500, chunk_overlap_tokens: 100 },
};

async function retrieveBatch(vsId, batchId) {
  const intentos = [
    () => vs.fileBatches.retrieve(batchId, { vector_store_id: vsId }),
    () => vs.fileBatches.retrieve(vsId, batchId),
    () => vs.fileBatches.retrieve({ vector_store_id: vsId, batch_id: batchId }),
  ];
  let lastErr;
  for (const intento of intentos) {
    try { return await intento(); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

async function waitForBatch(vsId, batchId) {
  for (let attempts = 0; attempts < 120; attempts++) {
    const batch = await retrieveBatch(vsId, batchId);
    if (batch.status === 'completed') return batch;
    if (batch.status === 'failed') throw new Error(`Batch falló: ${JSON.stringify(batch)}`);
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Timeout esperando indexación');
}

async function main() {
  console.log('\n🚀  Aurora — Creando store maestro con TODO el conocimiento\n');

  const store = await vs.create({ name: 'Aurora KB completa' });
  console.log(`📦  Store creado: ${store.id}`);

  const batch = await vs.fileBatches.create(store.id, {
    file_ids: FILE_IDS,
    chunking_strategy: CHUNKING,
  });

  console.log(`⏳  Indexando ${FILE_IDS.length} archivos (batch ${batch.id})`);
  process.stdout.write('   ');
  const done = await waitForBatch(store.id, batch.id);
  console.log('');
  console.log(`✅  Indexación completa: ${JSON.stringify(done.file_counts ?? {})}`);

  console.log('\n' + '═'.repeat(60));
  console.log('  Pon esta línea en tu .env (y en las env vars de Render):');
  console.log('═'.repeat(60));
  console.log(`\nOPENAI_VECTOR_STORE_ID=${store.id}\n`);

  fs.writeFileSync('master_store.env', `OPENAI_VECTOR_STORE_ID=${store.id}\n`);
  console.log('💾  Guardado también en master_store.env\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err?.message ?? err);
  process.exit(1);
});
