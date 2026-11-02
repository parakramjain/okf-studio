import { readFile,readdir,writeFile } from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
let output='Third-party runtime dependency notices\n\nGenerated from the locked dependency tree. Bundled subsets may contain fewer modules. See dist/sbom.cdx.json for the complete development/runtime inventory.\n';
for(const [directory,entry] of Object.entries(lock.packages)){
 if(!directory||entry.dev)continue;
 try{const pkg=JSON.parse(await readFile(directory+'/package.json','utf8'));const files=await readdir(directory);const license=files.find(name=>/^licen[sc]e(?:\.(?:md|txt))?$/i.test(name));output+=`\n${'='.repeat(72)}\n${pkg.name}@${pkg.version} — ${pkg.license||'See package license'}\n${license?await readFile(directory+'/'+license,'utf8'):'License reference: '+(pkg.repository?.url||pkg.homepage||'package metadata') }\n`;}catch{/* optional packages absent on this platform */}
}
await writeFile('THIRD_PARTY_NOTICES.txt',output,'utf8');
