import UTIF from 'utif';
import { DESIGN, FONT } from '../src/config.ts';
import { categoryDetails } from '../src/category.ts';
import { fitCoverText, coverTextPositions, TITLE_SIZES, DESCRIPTION_SIZES } from '../src/cover-layout.ts';
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
export async function renderLocal(file, options, format) {
  await fonts;
  if (!cache.has(file)) cache.set(file, decode(file));
  const image = await cache.get(file);
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = DESIGN.background; ctx.fillRect(0,0,1080,1440);
  const ratio = options.crop.mode === 'contain' ? Math.min(1080 / image.width,1440 / image.height) : Math.max(1080 / image.width,1440 / image.height);
  const w = image.width * ratio, h = image.height * ratio;
  ctx.drawImage(image,(1080-w) * (options.crop.mode === 'contain' ? .5 : options.crop.x),(1440-h) * (options.crop.mode === 'contain' ? .5 : options.crop.y),w,h);
  const gradient = ctx.createLinearGradient(0,0,0,1440);
  gradient.addColorStop(0,'rgba(20,42,51,0)'); gradient.addColorStop(.38,'rgba(20,42,51,0)');
  gradient.addColorStop(.68,'rgba(20,42,51,.45)'); gradient.addColorStop(1,'rgba(20,42,51,.96)');
  ctx.fillStyle=gradient; ctx.fillRect(0,0,1080,1440);
  const measure=(value,size)=>{ctx.font=size+'px "'+FONT.sans+'"';return ctx.measureText(value).width;};
  const title=await fitCoverText(options.title,TITLE_SIZES,measure,'标题');
  const description=options.subtitle ? await fitCoverText(options.subtitle,DESCRIPTION_SIZES,measure,'描述') : undefined;
  const positions=coverTextPositions(title,description);
  const category=categoryDetails(options.type);
  let badgeSize=44; while(measure(category.label,badgeSize)>888 && badgeSize>24)badgeSize-=2;
  const badgeWidth=measure(category.label,badgeSize)+64;
  ctx.fillStyle=DESIGN.badgeBackground;ctx.beginPath();ctx.roundRect(64,64,badgeWidth,82,41);ctx.fill();
  ctx.font=badgeSize+'px "'+FONT.sans+'"';ctx.fillStyle=DESIGN.badgeText;ctx.fillText(category.label,96,105+badgeSize*.35);
  ctx.font=title.fontSize+'px "'+FONT.sans+'"';ctx.fillStyle=DESIGN.titleColor;
  title.lines.forEach((line,i)=>ctx.fillText(line,DESIGN.textLeft,positions.titleY[i]));
  if(description){
    ctx.font=description.fontSize+'px "'+FONT.sans+'"';ctx.fillStyle=DESIGN.descriptionColor;
    description.lines.forEach((line,i)=>ctx.fillText(line,DESIGN.textLeft,positions.descriptionY[i]));
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片编码失败')),format==='jpeg'?'image/jpeg':'image/png',.94));
}
