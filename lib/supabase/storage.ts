/* Supabase Storage operations — always via the centralized client. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PropertyMedia, QueryResult } from '../types';
import { errorMessage } from '../utils';
import { fail, ok } from './queries';

export const BUCKETS = {
  propertyMedia: 'property-media',
  branding: 'branding',
  private: 'owner-private',
} as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const BRANDING_TYPES = [...IMAGE_TYPES, 'image/svg+xml'];
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;   // 12 MB
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;  // 120 MB
export const MAX_BRANDING_BYTES = 5 * 1024 * 1024;

export interface FileValidation { ok: boolean; error?: string; kind?: 'image' | 'video' }

export function validateMediaFile(file: File): FileValidation {
  if (!file.size) return { ok: false, error: `${file.name} is empty.` };
  if (IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `${file.name} exceeds the 12 MB image limit.` };
    return { ok: true, kind: 'image' };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) return { ok: false, error: `${file.name} exceeds the 120 MB video limit.` };
    return { ok: true, kind: 'video' };
  }
  return { ok: false, error: `${file.name} has an unsupported type (${file.type || 'unknown'}). Use JPG, PNG, WebP, AVIF, MP4 or WebM.` };
}

export function validateBrandingFile(file: File): FileValidation {
  if (!BRANDING_TYPES.includes(file.type)) return { ok: false, error: 'Use JPG, PNG, WebP, AVIF or SVG.' };
  if (file.size > MAX_BRANDING_BYTES) return { ok: false, error: 'Branding assets must be under 5 MB.' };
  return { ok: true, kind: 'image' };
}

function extension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 5) return fromName;
  const subtype = file.type.split('/')[1]?.replace('svg+xml', 'svg').replace('jpeg', 'jpg');
  return subtype || 'bin';
}

function publicUrl(client: SupabaseClient, path: string): string {
  return client.storage.from(BUCKETS.propertyMedia).getPublicUrl(path).data.publicUrl;
}

export interface UploadProgress {
  completed: number;
  total: number;
  currentFile: string;
}

/**
 * Full upload workflow: validate → upload → public URL → DB metadata.
 * Any failure rolls back objects already uploaded in this batch and
 * throws, so callers can never report a false success.
 */
export async function uploadPropertyMedia(
  client: SupabaseClient,
  propertyId: string,
  files: File[],
  onProgress?: (p: UploadProgress) => void,
): Promise<QueryResult<PropertyMedia[]>> {
  const validations = files.map(validateMediaFile);
  const bad = validations.find(v => !v.ok);
  if (bad) return fail(new Error(bad.error ?? 'Invalid file.'));

  const uploadedPaths: string[] = [];
  const records: Array<Omit<PropertyMedia, 'id' | 'created_at'>> = [];
  try {
    const { data: existing } = await client.from('property_media').select('position').eq('property_id', propertyId);
    let position = (existing ?? []).reduce((max, r) => Math.max(max, Number(r.position) + 1), 0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const kind = validations[i].kind!;
      const path = `${propertyId}/${crypto.randomUUID()}.${extension(file)}`;
      onProgress?.({ completed: i, total: files.length, currentFile: file.name });
      const { error } = await client.storage.from(BUCKETS.propertyMedia).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);
      uploadedPaths.push(path);
      records.push({
        property_id: propertyId,
        kind,
        storage_path: path,
        public_url: publicUrl(client, path),
        position: position++,
        is_cover: false,
        alt_text: file.name.replace(/\.[^.]+$/, ''),
        mime_type: file.type,
        file_size: file.size,
      });
    }

    const { data, error: dbError } = await client.from('property_media').insert(records).select('*');
    if (dbError) throw new Error(`Media saved to storage but the database record failed: ${dbError.message}. The uploaded objects have been rolled back.`);
    onProgress?.({ completed: files.length, total: files.length, currentFile: 'Complete' });
    return ok((data ?? []) as PropertyMedia[]);
  } catch (e) {
    if (uploadedPaths.length) {
      try { await client.storage.from(BUCKETS.propertyMedia).remove(uploadedPaths); } catch { /* report primary error */ }
    }
    return fail(e);
  }
}

export async function deletePropertyMedia(client: SupabaseClient, media: PropertyMedia): Promise<QueryResult<null>> {
  try {
    const { error: storageError } = await client.storage.from(BUCKETS.propertyMedia).remove([media.storage_path]);
    if (storageError) return fail(new Error(`Could not remove the stored object: ${storageError.message}`));
    const { error } = await client.from('property_media').delete().eq('id', media.id);
    if (error) return fail(new Error(`Object removed but the media record could not be deleted: ${error.message}`));
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function setCoverMedia(client: SupabaseClient, propertyId: string, mediaId: string): Promise<QueryResult<null>> {
  try {
    const { error: clear } = await client.from('property_media').update({ is_cover: false }).eq('property_id', propertyId);
    if (clear) return fail(clear);
    const { error } = await client.from('property_media').update({ is_cover: true }).eq('id', mediaId);
    if (error) return fail(error);
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function reorderMedia(client: SupabaseClient, ordered: PropertyMedia[]): Promise<QueryResult<null>> {
  try {
    for (let i = 0; i < ordered.length; i++) {
      const { error } = await client.from('property_media').update({ position: i }).eq('id', ordered[i].id);
      if (error) return fail(new Error(`Could not reorder media: ${error.message}`));
    }
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function updateMediaAlt(client: SupabaseClient, mediaId: string, alt: string): Promise<QueryResult<null>> {
  try {
    const { error } = await client.from('property_media').update({ alt_text: alt }).eq('id', mediaId);
    if (error) return fail(error);
    return ok(null);
  } catch (e) { return fail(e); }
}

/** Replace an existing media object without creating a duplicate row. */
export async function replaceMedia(client: SupabaseClient, media: PropertyMedia, file: File): Promise<QueryResult<PropertyMedia>> {
  const validation = validateMediaFile(file);
  if (!validation.ok) return fail(new Error(validation.error));
  if (validation.kind !== media.kind) return fail(new Error('Replacement must be the same media type (image or video).'));
  try {
    const path = `${media.property_id}/${crypto.randomUUID()}.${extension(file)}`;
    const { error: uploadError } = await client.storage.from(BUCKETS.propertyMedia).upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: false,
    });
    if (uploadError) return fail(new Error(`Replacement upload failed: ${uploadError.message}`));
    const { data, error } = await client.from('property_media').update({
      storage_path: path,
      public_url: publicUrl(client, path),
      mime_type: file.type,
      file_size: file.size,
    }).eq('id', media.id).select('*').single();
    if (error) {
      await client.storage.from(BUCKETS.propertyMedia).remove([path]);
      return fail(new Error(`Replacement uploaded but the record could not be updated: ${error.message}`));
    }
    await client.storage.from(BUCKETS.propertyMedia).remove([media.storage_path]);
    return ok(data as PropertyMedia);
  } catch (e) { return fail(e); }
}

export async function uploadBrandingAsset(client: SupabaseClient, file: File, folder: 'logos' | 'favicons' | 'hero'): Promise<QueryResult<{ url: string; path: string }>> {
  const validation = validateBrandingFile(file);
  if (!validation.ok) return fail(new Error(validation.error));
  try {
    const path = `${folder}/${crypto.randomUUID()}.${extension(file)}`;
    const { error } = await client.storage.from(BUCKETS.branding).upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: false,
    });
    if (error) return fail(new Error(`Branding upload failed: ${error.message}`));
    const { data } = client.storage.from(BUCKETS.branding).getPublicUrl(path);
    return ok({ url: data.publicUrl, path });
  } catch (e) { return fail(e); }
}

export async function uploadPrivateAsset(client: SupabaseClient, file: File): Promise<QueryResult<{ path: string }>> {
  try {
    if (file.size > 25 * 1024 * 1024) return fail(new Error('Private assets must be under 25 MB.'));
    const path = `private/${crypto.randomUUID()}.${extension(file)}`;
    const { error } = await client.storage.from(BUCKETS.private).upload(path, file, { upsert: false, contentType: file.type });
    if (error) return fail(new Error(`Private upload failed: ${error.message}`));
    return ok({ path });
  } catch (e) { return fail(e); }
}

export function storageErrorMessage(e: unknown): string { return errorMessage(e); }
