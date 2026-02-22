const fs = require('fs');
const path = require('path');

function findEmojis(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                findEmojis(fullPath);
            }
        } else if (file.match(/\.(tsx?|jsx?)$/)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                const match = line.match(/[^\x00-\x7F]/g);
                if (match) {
                    // Filter out accents
                    const filtered = match.filter(c => !'áéíóúâêîôûàèìòùãẽĩõũçÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃẼĨÕŨÇ•'.includes(c));
                    if (filtered.length > 0) {
                        console.log(`${fullPath}:${i + 1}: Found: ${filtered.join('')}`);
                    }
                }
            });
        }
    }
}

findEmojis('src');
