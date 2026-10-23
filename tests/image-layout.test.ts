import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { imageMode, cropRectangle } from '../src/image-layout.js';
import { cropSchema } from '../src/schema.js';
import { renderCover } from '../src/render.js';

test('smart mode limits cropping and uses blur for wide, square and very tall images', () => {
  assert.equal(imageMode(1080,1440,'smart'),'cover');
  assert.equal(imageMode(600,900,'smart'),'cover');
  assert.equal(imageMode(1600,900,'smart'),'blur');
  assert.equal(imageMode(1000,1000,'smart'),'blur');
  assert.equal(imageMode(400,2000,'smart'),'blur');
  assert.equal(imageMode(1600,900,'cover'),'cover');
  assert.equal(imageMode(1600,900,'contain'),'contain');
  assert.equal(cropSchema.parse(undefined).mode,'smart');
  assert.equal(cropSchema.safeParse({zoom:4}).success,false);
});

test('manual zoom and position stay inside the source, including small images', () => {
  for(const [width,height] of [[900,300],[300,900],[1080,1440],[1,1]]) {
    for(const x of [0,.5,1])for(const y of [0,.5,1])for(const zoom of [1,2,3]) {
      const rect = cropRectangle(width!,height!,cropSchema.parse({mode:'cover',x,y,zoom}));
      assert.ok(rect.width>=1 && rect.height>=1);
      assert.ok(rect.left>=0 && rect.top>=0);
      assert.ok(rect.left+rect.width<=width! && rect.top+rect.height<=height!);
    }
  }
  const base = cropRectangle(900,300,cropSchema.parse({mode:'cover'}));
  const zoomed = cropRectangle(900,300,cropSchema.parse({mode:'cover',zoom:2,x:1}));
  assert.ok(zoomed.width < base.width);
  assert.equal(zoomed.left+zoomed.width,900);
});

test('smart wide rendering retains both original edges and fills the unused area', async () => {
  const source=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="#eeeeee"/><rect width="150" height="300" fill="#ff0000"/><rect x="750" width="150" height="300" fill="#0000ff"/></svg>')).png().toBuffer();
  const output=await renderCover(source,{title:'智能适配',type:'游戏',index:1});
  const rgb=async(x:number,y:number)=>Array.from(await sharp(output).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer());
  assert.deepEqual(await rgb(20,544),[255,0,0]);
  assert.deepEqual(await rgb(1060,544),[0,0,255]);
  assert.ok((await rgb(540,300))[0]! > 150);
  assert.equal((await sharp(output).metadata()).height,1440);
});

test('smart mode ignores retained manual crop settings, while manual zoom changes the output', async () => {
  const source=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#eee"/><rect width="100" height="900" fill="#f00"/></svg>')).png().toBuffer();
  const options={title:'测试',type:'游戏',index:1};
  const smart=await renderCover(source,{...options,crop:{mode:'smart',x:0,y:0,zoom:3}});
  const centered=await renderCover(source,{...options,crop:{mode:'cover',x:.5,y:.5,zoom:1}});
  const manual=await renderCover(source,{...options,crop:{mode:'cover',x:0,y:0,zoom:3}});
  assert.deepEqual(smart,centered);
  assert.notDeepEqual(manual,centered);
});
