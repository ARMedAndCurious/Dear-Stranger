import crypto from 'node:crypto';

export function makeSlug(title) {
  const base = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'notebook';
  return `${base}-${crypto.randomBytes(5).toString('hex')}`;
}

export async function createWithUniqueSlug(model, fields, generate = makeSlug) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await model.create({ ...fields, slug: generate(fields.title) }); }
    catch (error) { if (error.code !== 11000 || !error.keyPattern?.slug || attempt === 4) throw error; }
  }
}
