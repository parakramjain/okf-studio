"""Render the bundled guide's intentionally small Markdown subset without dependencies."""
from pathlib import Path
import html
import re

def inline(value):
    value=html.escape(value)
    value=re.sub(r'`([^`]+)`',r'<code>\1</code>',value)
    value=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',value)
    return value

def render(body):
    result=[]
    for block in body.strip().split('\n\n'):
        lines=block.splitlines()
        picture=re.fullmatch(r'!\[([^\]]+)\]\((\.\./media/screenshots/[a-z-]+\.png)\)',block.strip())
        if picture:
            result.append('<figure><img loading="lazy" src="'+html.escape(picture[2])+'" alt="'+html.escape(picture[1])+'"><figcaption>'+html.escape(picture[1])+'</figcaption></figure>')
        elif lines[0].startswith('|'):
            cells=lambda row:[inline(c.strip()) for c in row.strip('|').split('|')]
            result.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+c+'</th>' for c in cells(lines[0]))+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+c+'</td>' for c in cells(row))+'</tr>' for row in lines[2:])+'</tbody></table></div>')
        elif all(re.match(r'^\d+\. ',line) for line in lines):
            result.append('<ol class="workflow">'+''.join('<li>'+inline(re.sub(r'^\d+\. ','',line))+'</li>' for line in lines)+'</ol>')
        elif all(line.startswith('- ') for line in lines):
            result.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in lines)+'</ul>')
        else: result.append('<p>'+inline(' '.join(lines))+'</p>')
    return '\n'.join(result)

source=Path('docs/USER_GUIDE.md').read_text(encoding='utf-8')
parts=re.split(r'^## (.+)$',source,flags=re.M)
sections=[]
for title,body in zip(parts[1::2],parts[2::2]):
    key=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')
    sections.append((key,title,render(body)))
nav=''.join(f'<a href="#{key}">{html.escape(title)}</a>' for key,title,_ in sections)
content=''.join(f'<section id="{key}"><h2>{html.escape(title)}</h2>{body}</section>' for key,title,body in sections)
result='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><!-- CSP --><title>OKF Studio — User guide</title><link rel="stylesheet" href="../media/guide.css"><script defer src="../media/guide.js"></script></head><body>
<a class="skip" href="#content">Skip to guide</a><header><a class="brand" href="#start-here"><strong>OKF Studio</strong><span>User guide · 0.4.1</span></a><label for="search">Find a feature or task</label><div class="search-row"><input id="search" type="search" placeholder="Try: context, MCP, Git, approval"><button id="clear" type="button">Clear</button></div><p id="search-status" role="status">Offline guide · included with your extension</p></header>
<div class="layout"><nav aria-label="Guide contents">'''+nav+'''</nav><main id="content"><h1>Turn code and documents into trusted knowledge that AI agents can use.</h1><p class="lead">Understand a repository. Ask cited questions. Give agents reliable context.</p>'''+content+'''<p id="no-results" hidden>No matching sections. Try a shorter search or clear the filter.</p><footer>Author, developer and owner: Parakram Jain · MIT · No telemetry exporter</footer></main></div></body></html>'''
Path('docs/USER_GUIDE.html').write_text(result+'\n',encoding='utf-8')
print(f'Generated guide with {len(sections)} sections.')
