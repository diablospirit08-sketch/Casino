"""Inspect and fix swapped 4/5 glyph mappings in the Casino fonts."""
import sys
from fontTools.ttLib import TTFont

FONTS = [r"E:\Projects\casino\fonts\CasinoFlat.ttf", r"E:\Projects\casino\fonts\Casino.ttf"]

def show(path):
    f = TTFont(path)
    cmap = f.getBestCmap()
    digits = {chr(cp): cmap[cp] for cp in range(0x30, 0x3A) if cp in cmap}
    print(path.split("\\")[-1], digits)
    f.close()

def fix(path):
    f = TTFont(path)
    for table in f["cmap"].tables:
        c = table.cmap
        if 0x34 in c and 0x35 in c:
            c[0x34], c[0x35] = c[0x35], c[0x34]
    f.save(path)
    f.close()
    print("fixed", path.split("\\")[-1])

if __name__ == "__main__":
    for p in FONTS:
        show(p)
    if len(sys.argv) > 1 and sys.argv[1] == "fix":
        for p in FONTS:
            fix(p)
            show(p)
