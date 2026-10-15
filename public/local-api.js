import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { coverOptionsSchema } from '../src/schema.ts';
import { categoryDetails } from '../src/category.ts';
import { safeFilenamePart } from '../src/filename.ts';
import { renderLocal } from './local-render.js';
import { nextIndex, history, readImage, saveCover } from './local-store.js';
const native = registerPlugin('CoverFiles');
const response = value => new Response(JSON.stringify(value), { headers: {'Content-Type':'application/json'} });
export { history };
async function importRemote(value, signal) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('请输入 HTTPS 图片直链');
  if (Capacitor.isNativePlatform()) {
    const data = await native.importImage({url: url.href});
    return await fetch(`data:${data.mime};base64,${data.data}`);
  }
  const result = await fetch(url, {signal, credentials:'omit'}).catch(() => {throw new Error('网站不允许浏览器读取图片，请下载后选择本地图片');});
  if (!result.ok) throw new Error('图片链接读取失败');
  const reader=result.body.getReader();const chunks=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20*1024*1024)throw new Error('图片超过 20 MB');chunks.push(value);} }
  finally { await reader.cancel(); }
  return new Response(new Blob(chunks,{type:result.headers.get('Content-Type')||'image/jpeg'}));
}
export async function apiFetch(url, options={}) {
  try {
    options.signal?.throwIfAborted();
    let result;
    if(url==='/api/sequence') return response({nextIndex:await nextIndex()});
    if(url==='/api/import-image') return await importRemote(JSON.parse(options.body).url,options.signal);
    if(url.startsWith('/api/covers/')) {
      const blob=await readImage(decodeURIComponent(url.slice('/api/covers/'.length)));
      if(!blob)throw new Error('本地封面不存在');
      return new Response(blob);
    }
    const data=options.body;const manual=String(data.get('index')||'').trim();
    const format=data.get('format');if(!['png','jpeg'].includes(format))throw new Error('不支持的导出格式');
    const file=data.get('image');if(!(file instanceof Blob))throw new Error('请选择图片');
    let candidate;
    for(let attempt=0;attempt<100;attempt++) {
      const expectedIndex = await nextIndex();
      const index=manual?Number(manual):Math.max(candidate || 1, expectedIndex);
      const parsed=coverOptionsSchema.safeParse({title:data.get('title'),subtitle:data.get('subtitle')||undefined,type:data.get('type'),index,crop:{mode:data.get('crop'),x:Number(data.get('x')),y:Number(data.get('y'))}});
      if(!parsed.success)throw new Error(parsed.error.issues[0].message);
      const blob=await renderLocal(file,parsed.data,format);
      options.signal?.throwIfAborted();
      if(url==='/api/preview')return new Response(blob);
      if(url!=='/api/covers')throw new Error('未知操作');
      const filename=`${String(index).padStart(3,'0')}-${categoryDetails(parsed.data.type).filename}-${safeFilenamePart(parsed.data.title,'cover')}.${format==='jpeg'?'jpg':'png'}`;
      const record={filename,index,format,createdAt:Date.now(),url:'/api/covers/'+encodeURIComponent(filename)};
      try {
        const saved=await saveCover(record,blob,!manual,expectedIndex);
        if(saved===true){result=record;break;}
        if(saved==='occupied') {
          if(manual)throw new Error('该编号和标题的封面已存在，请更换编号');
          candidate=index+1;
        }
      }
      catch(error){if(error?.name==='ConstraintError')throw new Error('该编号和标题的封面已存在，请更换编号');throw error;}
    }
    if(!result)throw new Error('同时生成的任务过多，请重试');
    return response(result);
  }catch(error){
    if(error.name==='AbortError')throw error;
    return new Response(JSON.stringify({error:error.message||'本地生成失败'}),{status:400});
  }
}
const base64 = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
export async function exportImage(record, share=false) {
  const blob=await readImage(record.filename);if(!blob)throw new Error('封面不存在');
  if(Capacitor.isNativePlatform()) {
    const data=await base64(blob);
    if(!share)return native.saveImage({data,filename:record.filename,mime:blob.type});
    // Only the current share file is retained in cache.
    const path='cover-share.'+(record.format==='jpeg'?'jpg':'png');
    const file=await Filesystem.writeFile({path,data,directory:Directory.Cache});
    return Share.share({title:record.filename,files:[file.uri]});
  }
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=record.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export const isNative = Capacitor.isNativePlatform();
