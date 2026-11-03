import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

version = json.loads(Path('package.json').read_text(encoding='utf-8'))['version']
target = Path(f'dist/okf-studio-{version}.vsix')
required = {'extension/docs/USER_GUIDE.html', 'extension/media/guide.css', 'extension/media/guide.js', 'extension/package.json', 'extension/out/extension.cjs', 'extension/out/worker.cjs', 'extension/out/mcp.cjs', 'extension/out/sql-wasm.wasm', 'extension/out/webview/main.js', 'extension/out/webview/style.css', 'extension/media/okf-studio-activity.svg', 'extension/media/okf-studio.svg', 'extension/media/okf-studio.png', 'extension/readme.md', 'extension/LICENSE.txt'}
required.update('extension/docs/' + name for name in ['FEATURES.md','PUBLISHING.md','SECURITY.md','UX_GUIDELINES.md','pending_issue.md'])
required.update('extension/media/screenshots/' + name + '.png' for name in ['repositories','knowledge-explorer','ai-assistant','vector-studio','agent-hub','quality-governance','features'])
with ZipFile(target) as archive:
    names = set(archive.namelist())
    missing = required - names
    if missing:
        raise SystemExit(f'Missing runtime files: {sorted(missing)}')
    if any('/node_modules/' in name or '/.cache/' in name or '/tests/' in name or name.endswith('host-test.cjs') for name in names):
        raise SystemExit('Unexpected development files in package')
    if archive.testzip() is not None:
        raise SystemExit('Invalid ZIP checksum')
    manifest = json.loads(archive.read('extension/package.json'))
    if manifest['displayName'] != 'OKF Studio' or manifest.get('icon') != 'media/okf-studio.png':
        raise SystemExit('Unexpected product name or extension logo')
    if manifest['main'] != './out/extension.cjs':
        raise SystemExit('Unexpected entrypoint')
    readme = archive.read('extension/readme.md').decode('utf-8')
    images = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', readme) + re.findall(r'<img[^>]+src=[\"\x27]([^\"\x27]+)', readme)
    if not images or any(not url.startswith('https://') for url in images):
        raise SystemExit('Packaged README images must resolve to HTTPS URLs')
    if 'docs/pendinissue.md' in readme or 'extension/docs/pendinissue.md' in names:
        raise SystemExit('Obsolete pending-issues path remains in the package')
    result = {'file': str(target), 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'runtime_files_verified': sorted(required), 'entries': sorted(names), 'version': manifest['version'], 'commands': len(manifest['contributes']['commands']), 'mcpProviders': manifest['contributes']['mcpServerDefinitionProviders']}
Path('dist/package-inspection.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
Path('dist/SHA256SUMS.txt').write_text(f"{result['sha256']}  {target.name}\n", encoding='utf-8')
print(json.dumps({key:result[key] for key in ['file','bytes','sha256','version','commands']}, indent=2))
