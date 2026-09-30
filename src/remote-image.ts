import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import sharp from 'sharp';
import { supportedImageFormat, type ImageFormat } from './image-format.js';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_REDIRECTS = 4;

export class RemoteImageError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'RemoteImageError';
  }
}

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export function parseRemoteImageUrl(input: unknown): URL {
  if (typeof input !== 'string' || !input.trim() || input.length > 4096) {
    throw new RemoteImageError('请输入有效的图片链接');
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new RemoteImageError('图片链接格式无效');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new RemoteImageError('只支持不含账号密码的 HTTP 或 HTTPS 图片链接');
  }
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (port !== 80 && port !== 443) {
    throw new RemoteImageError('图片链接只支持 80 或 443 端口');
  }
  url.hash = '';
  return url;
}

async function publicEndpoint(url: URL): Promise<{ address: string; family: number; originalHost: string }> {
  const originalHost = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(originalHost)) {
    if (!isPublicAddress(originalHost)) {
      throw new RemoteImageError('不能导入本机或内网图片链接');
    }
    return { address: originalHost, family: isIP(originalHost), originalHost };
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(originalHost, { all: true });
  } catch {
    throw new RemoteImageError('无法解析图片链接的域名', 502);
  }
  const publicAddress = addresses.find((item) => isPublicAddress(item.address));
  if (!publicAddress) {
    throw new RemoteImageError('不能导入本机或内网图片链接');
  }
  return { ...publicAddress, originalHost };
}

function fetchBytes(url: URL, address: string, family: number, originalHost: string): Promise<{
  bytes: Buffer;
  redirect?: string;
}> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request({
      hostname: address,
      family,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      path: url.pathname + url.search,
      method: 'GET',
      servername: isIP(originalHost) ? undefined : originalHost,
      headers: {
        Host: url.host,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/tiff,image/*;q=0.8',
        'User-Agent': 'CoverMaker/0.1'
      },
      timeout: 10000
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        resolve({ bytes: Buffer.alloc(0), redirect: response.headers.location });
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new RemoteImageError('图片服务器返回 HTTP ' + status, 502));
        return;
      }
      const length = Number(response.headers['content-length'] || 0);
      if (length > MAX_IMAGE_BYTES) {
        response.destroy();
        reject(new RemoteImageError('网络图片超过 20 MB', 413));
        return;
      }
      const contentType = String(response.headers['content-type'] || '').split(';')[0]?.trim().toLowerCase();
      if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
        response.destroy();
        reject(new RemoteImageError('链接返回的内容不是图片'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) {
          response.destroy(new RemoteImageError('网络图片超过 20 MB', 413));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ bytes: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    const deadline = setTimeout(() => request.destroy(new RemoteImageError('读取图片超时', 502)), 15000);
    request.once('close', () => clearTimeout(deadline));
    request.on('timeout', () => request.destroy(new RemoteImageError('读取图片超时', 502)));
    request.on('error', (error) => {
      reject(error instanceof RemoteImageError ? error : new RemoteImageError('无法读取网络图片', 502));
    });
    request.end();
  });
}

export interface ImportedImage {
  bytes: Buffer;
  format: ImageFormat;
}

export async function validateImportedImage(bytes: Buffer): Promise<ImportedImage> {
  let metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new RemoteImageError('链接返回的图片无效或像素过大');
  }
  const format = supportedImageFormat(metadata);
  if (!format || !metadata.width || !metadata.height ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new RemoteImageError('只支持 JPEG、PNG、WebP、AVIF 和 TIFF 图片');
  }
  return { bytes, format };
}

export async function importRemoteImage(input: unknown): Promise<ImportedImage> {
  let url = parseRemoteImageUrl(input);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const endpoint = await publicEndpoint(url);
    const result = await fetchBytes(url, endpoint.address, endpoint.family, endpoint.originalHost);
    if (result.redirect) {
      if (redirects === MAX_REDIRECTS) throw new RemoteImageError('图片链接跳转次数过多');
      try {
        url = parseRemoteImageUrl(new URL(result.redirect, url).toString());
      } catch (error) {
        if (error instanceof RemoteImageError) throw error;
        throw new RemoteImageError('图片链接跳转地址无效');
      }
      continue;
    }
    return validateImportedImage(result.bytes);
  }
  throw new RemoteImageError('图片链接跳转次数过多');
}
