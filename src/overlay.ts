import './font-environment.js';
import sharp from 'sharp';
import { fitCoverText, coverTextPositions, TITLE_SIZES, DESCRIPTION_SIZES } from './cover-layout.js';
import { DESIGN, FONT } from './config.js';
import { categoryDetails } from './category.js';
import type { CoverOptions } from './schema.js';

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function textWidth(text: string, family: string, size: number): Promise<number> {
  const { info } = await sharp({
    text: {
      text: escapeXml(text),
      font: family + ' ' + size,
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true });
  return info.width;
}

export function layoutTitle(title: string) {
  return fitCoverText(title, TITLE_SIZES, (text,size) => textWidth(text,FONT.sans,size), '标题');
}

export async function createOverlay(options: CoverOptions): Promise<Buffer> {
  const category = categoryDetails(options.type);
  const title = await layoutTitle(options.title);
  const description = options.subtitle ? await fitCoverText(options.subtitle, DESCRIPTION_SIZES, (text,size) => textWidth(text,FONT.sans,size), '描述') : undefined;
  const positions = coverTextPositions(title, description);
  let badgeSize=44;
  while(await textWidth(category.label,FONT.sans,badgeSize)>888 && badgeSize>24)badgeSize-=2;
  const badgeWidth=await textWidth(category.label,FONT.sans,badgeSize)+64;
  const parts=[
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440">',
    '<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#142A33" stop-opacity="0"/><stop offset=".38" stop-color="#142A33" stop-opacity="0"/><stop offset=".68" stop-color="#142A33" stop-opacity=".45"/><stop offset="1" stop-color="#142A33" stop-opacity=".96"/></linearGradient></defs>',
    '<rect width="1080" height="1440" fill="url(#shade)"/>',
    '<rect x="64" y="64" width="'+badgeWidth+'" height="82" rx="41" fill="'+DESIGN.badgeBackground+'"/>'
  ];
  const text=(value:string,x:number,y:number,size:number,color:string)=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" font-family="'+FONT.sans+'" fill="'+color+'">'+escapeXml(value)+'</text>';
  parts.push(text(category.label,96,105+badgeSize*.35,badgeSize,DESIGN.badgeText));
  title.lines.forEach((line,i)=>parts.push(text(line,DESIGN.textLeft,positions.titleY[i]!,title.fontSize,DESIGN.titleColor)));
  if(description)description.lines.forEach((line,i)=>parts.push(text(line,DESIGN.textLeft,positions.descriptionY[i]!,description.fontSize,DESIGN.descriptionColor)));
  parts.push('</svg>');
  return Buffer.from(parts.join(''),'utf8');
}
