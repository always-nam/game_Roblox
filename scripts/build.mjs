// 단일 HTML 파일 빌드: dist/tilt-marble.html (CSS·JS 인라인, 외부 파일 없이 열림)
// --fragment 옵션: <!doctype>/<html>/<head>/<body> 없이 본문 조각만 출력 (Artifact 미리보기용)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const fragment = process.argv.includes('--fragment');
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('style.css', 'utf8');
const pick = (name) => {
  const m = html.match(new RegExp(`<!-- BUILD:${name} START -->([\\s\\S]*?)<!-- BUILD:${name} END -->`));
  if (!m) throw new Error(`BUILD:${name} 표시를 찾을 수 없습니다`);
  return m[1].trim();
};
const strip = (src) => src
  .replace(/^import [^;]+;\s*$/gm, '')
  .replace(/^export (const|function|let)/gm, '$1');
const files = ['src/engine.js', 'src/levels.js', 'src/generator.js', 'src/motion.js', 'src/anim.js', 'src/sound.js', 'src/story.js', 'src/scenery.js', 'src/main.js']
const js = files
  .map((f) => `// ---- ${f} ----\n${strip(readFileSync(f, 'utf8'))}`)
  .join('\n');
if (/^\s*(import|export)\s/m.test(js)) throw new Error('남은 import/export 구문이 있습니다');
// 파일을 하나로 합치므로 최상위 이름이 겹치면 안 된다(함수는 조용히 덮어써지므로 미리 막는다)
const seen = new Map();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/^(?:export )?(?:async )?(?:function\*?|const|let|var|class) ([A-Za-z_$][\w$]*)/gm)) {
    if (seen.has(m[1])) throw new Error(`최상위 이름 '${m[1]}'이(가) ${seen.get(m[1])}와 ${f}에 모두 있습니다`);
    seen.set(m[1], f);
  }
}

const head = `${pick('HEAD')}\n<style>\n${css}</style>`;
const body = `${pick('BODY')}\n<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>`;
const out = fragment
  ? `${head}\n${body}\n`
  : `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
mkdirSync('dist', { recursive: true });
const file = fragment ? 'dist/tilt-marble.fragment.html' : 'dist/tilt-marble.html';
writeFileSync(file, out);
console.log(`${file} (${(out.length / 1024).toFixed(1)} KB)`);
