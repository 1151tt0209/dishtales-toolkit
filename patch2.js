const fs=require('fs');let s=fs.readFileSync('world.js','utf8');
s=s.replace("tg.addColorStop(0, '#6a5a8c'); tg.addColorStop(0.35, '#4c4a78');","tg.addColorStop(0, '#9a8ab8'); tg.addColorStop(0.1, '#5a5080'); tg.addColorStop(0.35, '#4c4a78');");
s=s.replace("x.fillStyle = tg; x.fillRect(-ST.ox, 140, ST.w, ST.h);\n    x.globalCompositeOperation = 'source-over';\n    for (const [lx, ly, lw, lh, a] of lights) {",
"x.fillStyle = tg; x.fillRect(-ST.ox, 0, ST.w, ST.h);\n    x.globalCompositeOperation = 'screen';\n    for (const [lx, ly, lw, lh, a] of lights) {");
s=s.replace("lights.push([wx + 8, fy + 48, ww - 16, fh - 96, 0.75]);","lights.push([wx + 8, fy + 48, ww - 16, fh - 96, 0.5 + rn() * 0.3]);");
s=s.replace("if (night) lights.push([bx + 10, gy + 70, bw - 20, 290, 0.5]);","if (night) lights.push([bx + 10, gy + 70, bw - 20, 290, 0.32]);");
s=s.replace("    for (const sgn of signsL) signboard(x, ...sgn);\n    x.globalCompositeOperation = 'screen';","    x.globalCompositeOperation = 'source-over';\n    for (const sgn of signsL) signboard(x, ...sgn);\n    x.globalCompositeOperation = 'screen';");
fs.writeFileSync('world.js',s);
