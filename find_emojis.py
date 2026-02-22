import os
import sys

def find_non_ascii(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        if 'dist' in dirs:
            dirs.remove('dist')
            
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for char in line:
                                if ord(char) > 127:
                                    # Filter out common Portuguese accents
                                    if char not in 'áéíóúâêîôûàèìòùãẽĩõũçÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃẼĨÕŨÇ':
                                        print(f"{path}:{i+1}: Found non-ASCII: {char} (U+{ord(char):04X})")
                except Exception as e:
                    print(f"Error reading {path}: {e}")

if __name__ == "__main__":
    find_non_ascii('src')
