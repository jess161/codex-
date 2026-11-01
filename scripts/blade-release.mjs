import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Web and standalone builds use the same version, independent of build time.
export function bladeRelease(){
  const hash=createHash('sha256'),root=resolve('src/blade');
  function addSource(directory){
    for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=resolve(directory,entry.name);
      if(entry.isDirectory())addSource(path);
      else if(entry.isFile()){hash.update(path.slice(root.length));hash.update(readFileSync(path));}
    }
  }
  addSource(root);
  hash.update(readFileSync(resolve('index.html')));
  hash.update(readFileSync(resolve('public/blade-icon.svg')));
  return hash.digest('hex').slice(0,16);
}
