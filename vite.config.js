import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({ root: 'public', publicDir: false,
  plugins: [{name:'font-licenses', generateBundle() {
    for(const name of ['LICENSE-SANS','LICENSE-SERIF']) this.emitFile({type:'asset', fileName:'licenses/'+name+'.txt',source:readFileSync(new URL('./assets/fonts/'+name,import.meta.url))});
  }}],
  build: { outDir: '../dist-mobile', emptyOutDir: true }, server: { host: '127.0.0.1', port: 3001 } });
