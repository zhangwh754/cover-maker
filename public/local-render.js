import UTIF from 'utif';
import { DESIGN, FONT } from '../src/config.ts';
import { categoryDetails } from '../src/category.ts';
const fonts = Promise.all([
  new FontFace(FONT.serif, `url(${new URL('../assets/fonts/NotoSerifSC-Regular.otf', import.meta.url)})`).load(),
  new FontFace(FONT.sans, `url(${new URL('../assets/fonts/NotoSansSC-Regular.otf', import.meta.url)})`).load()
]).then(loaded => loaded.forEach(font => document.fonts.add(font)));
const cache = new WeakMap();
async function decode(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('图片超过 20 MB');
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  let image;
  if ((header[0] === 73 && header[1] === 73 && header[2] === 42) || (header[0] === 77 && header[1] === 77 && header[3] === 42)) {
    const page = UTIF.decode(bytes)[0];
    if (!page || page.t256[0] * page.t257[0] > 25e6) throw new Error('图片像素超过 2500 万或 TIFF 无效');
    UTIF.decodeImage(bytes, page);
    image = document.createElement('canvas'); image.width = page.width; image.height = page.height;
    image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), page.width, page.height), 0, 0);
  } else {
    try { image = await createImageBitmap(file); } catch { throw new Error('手机无法读取此图片，请转换为 JPG 或 PNG'); }
  }
  if (image.width * image.height > 25e6) { image.close?.(); throw new Error('图片像素超过 2500 万，请先缩小'); }
  return image;
}
function layout(ctx, text) {
  const fits = (lines, size) => { ctx.font = `${size}px "${FONT.serif}"`; return lines.every(line => ctx.measureText(line).width <= 755); };
  for (const size of [70,66,62,58,54,50]) if (fits([text], size)) return { lines: [text], size };
  const chars = Intl.Segmenter ? Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text), item => item.segment) : Array.from(text);
  const splits = Array.from({length: chars.length - 1}, (_, i) => i + 1).sort((a,b) => {
    const space = i => /\s/.test(chars[i - 1]) || /\s/.test(chars[i]);
    return Number(space(b)) - Number(space(a)) || Math.abs(a - chars.length / 2) - Math.abs(b - chars.length / 2);
  });
  for (const size of [64,60,56,52,48,44,40]) for (const split of splits) {
    const lines = [chars.slice(0,split).join('').trim(), chars.slice(split).join('').trim()];
    if (lines.every(Boolean) && fits(lines, size)) return {lines,size};
  }
  throw new Error('标题太长，请缩短后重试');
}
export async function renderLocal(file, options, format) {
  await fonts;
  if (!cache.has(file)) cache.set(file, decode(file));
  const image = await cache.get(file);
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = DESIGN.background; ctx.fillRect(0,0,1080,1440);
  ctx.fillStyle = DESIGN.imageBackground; ctx.fillRect(205,75,805,925);
  const ratio = options.crop.mode === 'contain' ? Math.min(805 / image.width,925 / image.height) : Math.max(805 / image.width,925 / image.height);
  const w = image.width * ratio, h = image.height * ratio;
  ctx.save(); ctx.beginPath(); ctx.rect(205,75,805,925); ctx.clip();
  ctx.drawImage(image,205 + (805-w) * (options.crop.mode === 'contain' ? .5 : options.crop.x),75 + (925-h) * (options.crop.mode === 'contain' ? .5 : options.crop.y),w,h); ctx.restore();
  ctx.strokeStyle = '#D5D0C7'; ctx.strokeRect(205.5,75.5,804,924);
  const text = (value,x,y,size,family,color,align='left') => {ctx.font=`${size}px "${family}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);};
  Array.from('每日推荐').forEach((char,i) => text(char,75,130+i*52,38,FONT.serif,'#252525'));
  text(String(options.index).padStart(3,'0'),75,360,27,FONT.sans,'#555555');
  ctx.strokeStyle='#555555';ctx.beginPath();ctx.moveTo(75,385);ctx.lineTo(112,385);ctx.stroke();
  const category=categoryDetails(options.type);ctx.fillStyle=category.accent;
  ctx.beginPath();ctx.moveTo(219,1053);ctx.lineTo(231,1065);ctx.lineTo(219,1077);ctx.lineTo(207,1065);ctx.closePath();ctx.fill();
  text(category.label,245,1075,27,FONT.sans,'#313131');
  const title=layout(ctx,options.title);
  title.lines.forEach((line,i)=>text(line,607.5,title.lines.length===1?1190:1152+i*72,title.size,FONT.serif,'#191919','center'));
  if(options.subtitle){
    let size;for(size of [34,31,28,25,22]){ctx.font=`${size}px "${FONT.sans}"`;if(ctx.measureText(options.subtitle).width<=755)break;}
    if(ctx.measureText(options.subtitle).width>755)throw new Error('副标题太长，请缩短后重试');
    text(options.subtitle,607.5,1290,size,FONT.sans,'#333333','center');
  }
  ctx.letterSpacing='4px'; text('DAILY RECOMMEND',607.5,1370,16,FONT.sans,'#89847B','center');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片编码失败')),format==='jpeg'?'image/jpeg':'image/png',.94));
}
