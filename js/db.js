/* ===== TIENDA ESCOLAR - CAPA DE DATOS =====
 *
 * Reemplaza la "Tables API" de Genspark (fetch('tables/...')), que SOLO
 * existe dentro de Genspark. Este archivo funciona en cualquier lugar.
 *
 * Dos modos:
 *  1) FIREBASE (recomendado): los datos se guardan en la nube de Google
 *     (Cloud Firestore) y se comparten entre todos los dispositivos:
 *     el admin crea un producto y TODOS los clientes lo ven.
 *     → Pega la configuración de tu proyecto en FIREBASE_CONFIG.
 *
 *  2) LOCAL (si FIREBASE_CONFIG está vacío): los datos se guardan en el
 *     localStorage del navegador. Sirve para probar, pero cada navegador
 *     tiene sus propios datos (lo que crees en tu PC no se ve en el celular).
 *
 * Uso desde el resto del código:
 *   await DB.list('products')            → array de registros
 *   await DB.get('orders', id)           → registro o null
 *   await DB.create('orders', datos)     → registro creado (con id, created_at)
 *   await DB.update('orders', id, campos)→ registro actualizado (parcial)
 *   await DB.remove('products', id)
 */

// ─────────────── CONFIGURACIÓN ───────────────
// Pega aquí el objeto que te da Firebase (Configuración del proyecto → Tus apps → Web).
// Déjalo en null para usar el modo local.
const FIREBASE_CONFIG = null;
/* Ejemplo:
const FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "tienda-escolar.firebaseapp.com",
  projectId: "tienda-escolar",
  storageBucket: "tienda-escolar.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
*/

const DB = (() => {
  const TABLES = ['products', 'orders', 'coupons', 'users'];
  const FIREBASE_VERSION = '10.12.2';
  const mode = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey ? 'firebase' : 'local';
  let fs = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  const ready = mode === 'firebase'
    ? loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`)
        .then(() => loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore-compat.js`))
        .then(() => {
          if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
          fs = firebase.firestore();
        })
    : Promise.resolve();

  // ── utilidades ──
  const now = () => Date.now();
  const genId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + now() + '-' + Math.random().toString(36).slice(2, 10));
  // Firestore no acepta valores undefined; esto los elimina
  const clean = obj => JSON.parse(JSON.stringify(obj));
  const byCreated = (a, b) => (a.created_at || 0) - (b.created_at || 0);

  // ── modo local ──
  const lsKey = t => 'tienda_db_' + t;
  function readLocal(table) {
    try { return JSON.parse(localStorage.getItem(lsKey(table)) || '[]'); } catch { return []; }
  }
  function writeLocal(table, rows) {
    try { localStorage.setItem(lsKey(table), JSON.stringify(rows)); }
    catch (e) { throw new Error('El almacenamiento del navegador está lleno. Usa Firebase para guardar más datos.'); }
  }

  // ── API pública ──
  async function list(table) {
    await ready;
    let rows;
    if (fs) {
      const snap = await fs.collection(table).get();
      rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } else {
      rows = readLocal(table);
    }
    return rows.sort(byCreated); // más antiguos primero
  }

  async function get(table, id) {
    await ready;
    if (fs) {
      const doc = await fs.collection(table).doc(String(id)).get();
      return doc.exists ? { ...doc.data(), id: doc.id } : null;
    }
    return readLocal(table).find(r => r.id === id) || null;
  }

  async function create(table, data) {
    await ready;
    const id = String(data.id || genId());
    const rec = clean({ ...data, id, created_at: data.created_at || now(), updated_at: now() });
    if (fs) {
      await fs.collection(table).doc(id).set(rec);
    } else {
      const rows = readLocal(table).filter(r => r.id !== id);
      rows.push(rec);
      writeLocal(table, rows);
    }
    return rec;
  }

  // Actualización parcial (como PATCH). Si no existe, lanza error.
  async function update(table, id, changes) {
    await ready;
    const patch = clean({ ...changes, updated_at: now() });
    delete patch.id; delete patch.created_at;
    if (fs) {
      await fs.collection(table).doc(String(id)).update(patch);
      return get(table, id);
    }
    const rows = readLocal(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`No existe ${table}/${id}`);
    rows[idx] = { ...rows[idx], ...patch };
    writeLocal(table, rows);
    return rows[idx];
  }

  async function remove(table, id) {
    await ready;
    if (fs) { await fs.collection(table).doc(String(id)).delete(); return; }
    writeLocal(table, readLocal(table).filter(r => r.id !== id));
  }

  // ── respaldo: exportar / importar ──
  async function exportAll() {
    const out = {};
    for (const t of TABLES) out[t] = await list(t);
    return out;
  }

  // Acepta: un array, el formato de Genspark { data: [...] },
  // o un respaldo completo { products: [...], orders: [...], ... }
  async function importData(json, defaultTable = 'products') {
    const groups = {};
    if (Array.isArray(json)) groups[defaultTable] = json;
    else if (json && Array.isArray(json.data)) groups[defaultTable] = json.data;
    else if (json && typeof json === 'object') TABLES.forEach(t => { if (Array.isArray(json[t])) groups[t] = json[t]; });

    let count = 0;
    for (const [table, rows] of Object.entries(groups)) {
      for (const r of rows) {
        // Genspark agrega campos internos que no necesitamos
        const { gs_project_id, gs_table_name, deleted, ...data } = r;
        if (deleted) continue;
        await create(table, data);
        count++;
      }
    }
    return count;
  }

  // Reduce una imagen base64 (comprobantes) para que quepa en la base de datos
  function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
    return new Promise(resolve => {
      if (!dataUrl || !dataUrl.startsWith('data:image')) return resolve(dataUrl || '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  return { mode, ready, list, get, create, update, remove, exportAll, importData, compressImage };
})();
