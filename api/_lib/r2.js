// api/_lib/r2.js
// Cloudflare R2 via its S3-compatible API. App-level credentials from env —
// no per-user OAuth, no tokens to refresh, nothing ever exposed to the browser.
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function presignPutUrl(key, contentType, expiresIn = 900) {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

export function presignGetUrl(key, expiresIn = 3600) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    { expiresIn }
  );
}

// Key segments stay human-readable; strip path separators and URL-hostile chars.
export function sanitizeSegment(s) {
  return (s || 'misc').replace(/[\\/:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim() || 'misc';
}

// True only when every R2 env var is present. Used by the health endpoint to
// distinguish "not configured" from "configured but unreachable". Never echoes
// the values — booleans only.
export function r2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

// Cheap reachability probe: HEAD the bucket with the server creds. Throws on
// any failure (auth, network, missing bucket); the caller maps that to ok:false.
export async function bucketReachable() {
  await client().send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
  return true;
}
