/**
 * Aurora — Adjuntar archivos a Vector Stores (versión final)
 * Compatible con OpenAI SDK que usa retrieve(batchId, { vector_store_id })
 */

import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const vs = client.vectorStores ?? client.beta?.vectorStores;

if (!vs) {
  console.error('❌  Instala: npm install openai@latest');
  process.exit(1);
}

const ARCHIVOS = {
  primeros_pasos:       'file-DDsfHhdneoG9s7ASxHDGsH',
  conocer_la_mente:     'file-93ruBHtXTL52PvzD7cPAoA',
  hipnosis:             'file-HSbb9GQ8Rt3icC5ukyQ8TD',
  apego:                'file-ST4mCptpvRmXaL12zBAABp',
  invitados_especiales: 'file-VSf3JCb4bhe89sJCuQp7C7',
  sensualidad:          'file-MNr71p9D9cYF9gMmGusTQY',
  geishas:              'file-BB8wN4nS9vKvtMwPDJkvE4',
  estrategia:           'file-L91V61QXHXe6dmeRDdzRff',
  detectar_hombre:      'file-9UF5vXpzieGhSGjzS9cJm6',
  neuropsicologia:      'file-C5L6shjSNSWtuyFgXCCJ7R',
};

const VECTOR_STORES = {
  primeros_pasos:       'vs_6a07ed26e5f0819180dba9b5e844cbec',
  conocer_la_mente:     'vs_6a07ed299d108191bf2e676a9dea5371',
  hipnosis:             'vs_6a07ed2c18fc8191a91243bfeabd1cf0',
  apego:                'vs_6a07ed2ec3c08191b2c67acfb23c3f7f',
  invitados_especiales: 'vs_6a07ed3131588191bb4f64c630174d50',
  sensualidad:          'vs_6a07ed3377e0819192b1f963649dbe74',
  geishas:              'vs_6a07ed3553048191ab9f082d0ec0c9e8',
  estrategia:           'vs_6a07ed377a0c8191a98f7f33ea0bf811',
  detectar_hombre:      'vs_6a07ed3984108191af93d3a7e5b1c1ef',
  neuropsicologia:      'vs_6a07ed3b54d081918769c9c838bf2df3',
};

const MODULOS = [
  { key: 'primeros_pasos',        label: 'Tus Primeros Pasos' },
  { key: 'conocer_la_mente',      label: 'Conocer la Mente' },
  { key: 'hipnosis',              label: 'Hipnosis' },
  { key: 'apego',                 label: 'El Apego' },
  { key: 'invitados_especiales',  label: 'Invitados Especiales' },
  { key: 'sensualidad',           label: 'Mi Sensualidad' },
  { key: 'geishas',               label: 'Los Secretos de las Geishas' },
  { key: 'estrategia',            label: 'Estrategia y Comunicación' },
  { key: 'detectar_hombre',       label: 'Cómo Detectar Hombre No Confiable' },
  { key: 'neuropsicologia',       label: 'Clases con la Neuropsicóloga' },
];

const CHUNKING = {
  type: 'static',
  static: { max_chunk_size_tokens: 500, chunk_overlap_tokens: 100 }
};

const log = (e, m) => console.log(`${e}  ${m}`);

// ─── Retrieve con múltiples firmas según versión de SDK ─────────────────────
async function retrieveBatch(vsId, batchId) {
  const intentos = [
    // Firma A: SDK más nueva — (batchId, { vector_store_id })
    () => vs.fileBatches.retrieve(batchId, { vector_store_id: vsId }),
    // Firma B: SDK media — (vsId, batchId) posicional
    () => vs.fileBatches.retrieve(vsId, batchId),
    // Firma C: SDK con objeto único
    () => vs.fileBatches.retrieve({ vector_store_id: vsId, batch_id: batchId }),
  ];

  let lastErr;
  for (const intento of intentos) {
    try {
      return await intento();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function waitForBatch(vsId, batchId) {
  let attempts = 0;
  while (attempts < 80) {
    const batch = await retrieveBatch(vsId, batchId);
    if (batch.status === 'completed') return batch;
    if (batch.status === 'failed') throw new Error(`Batch falló: ${JSON.stringify(batch)}`);
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 4000));
    attempts++;
  }
  throw new Error('Timeout');
}

async function procesarModulo(modulo) {
  const vsId   = VECTOR_STORES[modulo.key];
  const fileId = ARCHIVOS[modulo.key];

  log('📄', `${modulo.label}`);

  // 1. Crear el batch (esto funciona — el error está después)
  const batch = await vs.fileBatches.create(vsId, {
    file_ids:          [fileId],
    chunking_strategy: CHUNKING,
  });

  log('⏳', `Indexando batch ${batch.id}`);
  process.stdout.write('   ');
  await waitForBatch(vsId, batch.id);
  console.log('');
  log('✅', `${modulo.key} listo`);
  console.log('');

  return { key: modulo.key, vsId };
}

async function main() {
  console.log('\n🚀  Aurora — Indexando archivos\n');

  const resultados = [];
  for (const modulo of MODULOS) {
    try {
      const r = await procesarModulo(modulo);
      if (r) resultados.push(r);
    } catch (err) {
      log('❌', `${modulo.key}: ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Copia estas líneas a tu .env:');
  console.log('═'.repeat(60) + '\n');

  const lines = resultados.map(({ key, vsId }) => `VS_${key.toUpperCase()}=${vsId}`);
  lines.forEach(l => console.log(l));

  fs.writeFileSync('vector_stores.env', lines.join('\n') + '\n');
  console.log('\n💾  vector_stores.env guardado\n');
}

main().catch(err => {
  console.error('❌  Fatal:', err.message);
  process.exit(1);
});
