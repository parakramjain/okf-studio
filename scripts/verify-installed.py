import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

dist = Path('dist')
for artifact in list(dist.glob('*.log')) + [dist / 'security-audit.json']:
    raw = artifact.read_bytes()
    if raw.startswith((b'\xff\xfe', b'\xfe\xff')):
        artifact.write_text(raw.decode('utf-16'), encoding='utf-8')

source_manifest = json.loads(Path('package.json').read_text(encoding='utf-8'))
version = source_manifest['version']
installed = Path(f".cache/vsix-extensions/{source_manifest['publisher'].lower()}.{source_manifest['name'].lower()}-{version}")
matches = []
with ZipFile(dist / f'okf-studio-{version}.vsix') as archive:
    for name in archive.namelist():
        if not (name.startswith('extension/out/') or name.startswith('extension/media/') or name == 'extension/docs/USER_GUIDE.html') or name.endswith('/'):
            continue
        relative = name.removeprefix('extension/')
        local = installed / relative
        if not local.is_file() or local.read_bytes() != archive.read(name):
            raise SystemExit(f'Installed runtime differs: {relative}')
        matches.append({'path': relative, 'sha256': hashlib.sha256(local.read_bytes()).hexdigest()})
    manifest = json.loads(archive.read('extension/package.json'))
    installed_manifest = json.loads((installed / 'package.json').read_text(encoding='utf-8'))
    assert installed_manifest['version'] == manifest['version']
    assert installed_manifest['main'] == manifest['main']
    assert installed_manifest['contributes'] == manifest['contributes']

smoke = (dist / 'host-packaged-test.log').read_text(encoding='utf-8')
assert 'OKF HOST ACCEPTANCE:' in smoke and 'Exit code:   0' in smoke
audit = json.loads((dist / 'security-audit.json').read_text(encoding='utf-8'))
assert audit['metadata']['vulnerabilities']['total'] == 0
report = {'installed_version': manifest['version'], 'runtime_matches_final_vsix': True, 'contributions_match': True, 'packaged_host_smoke_passed': True, 'security_vulnerabilities': 0, 'runtime_files': matches}
(dist / 'installed-runtime-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ['installed_version', 'runtime_matches_final_vsix', 'contributions_match', 'packaged_host_smoke_passed', 'security_vulnerabilities']}, indent=2))
