"""Writes the generic illustrated SVG pool used for gallery / map / dashboard slots.

All artwork is abstract geometry authored here: no sigils, crests, logos, real-world
imagery, real coordinates, map tiles or external references. Re-run to regenerate.

    python tools/make_svgs.py
"""
import io, os

# This script lives in tools/, so public/ is resolved from the repo root rather than
# from the working directory — it can be run from anywhere.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(_REPO_ROOT, 'public', 'demo-images')
os.makedirs(OUT, exist_ok=True)

HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">'
NOTE = '  <!-- Abstract placeholder. No sigil, crest, real-world imagery or coordinates. -->'


def cap(text, y=430, fill='#8A97A0'):
    return ('  <text x="400" y="%d" font-size="13" fill="%s" text-anchor="middle" '
            'font-family="sans-serif">%s</text>') % (y, fill, text)


FILES = {}

# 3 — a keep / fortified hall
FILES['scene-keep.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#EEF2F4"/>',
    '  <rect x="250" y="150" width="300" height="230" fill="#C3CDD4"/>',
    '  <rect x="210" y="110" width="60" height="270" fill="#AEBAC3"/>',
    '  <rect x="530" y="110" width="60" height="270" fill="#AEBAC3"/>',
    '  <polygon points="240,110 270,70 300,110" fill="#8E9DA8"/>',
    '  <polygon points="520,110 550,70 580,110" fill="#8E9DA8"/>',
    '  <rect x="370" y="270" width="60" height="110" rx="30" fill="#7E8D99"/>',
    '  <rect x="0" y="378" width="800" height="24" fill="#9AA8B1"/>',
    cap('איור סכמטי — מעוז מבוצר'), '</svg>']

# 4 — a river crossing
FILES['scene-river.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#EDF3F5"/>',
    '  <path d="M0 300 Q200 250 400 300 T800 300 L800 450 L0 450 Z" fill="#AFC9D6"/>',
    '  <path d="M0 330 Q200 285 400 330 T800 330 L800 450 L0 450 Z" fill="#93B4C6"/>',
    '  <rect x="300" y="268" width="200" height="14" rx="5" fill="#9E8E78"/>',
    '  <rect x="330" y="282" width="10" height="42" fill="#8A7B67"/>',
    '  <rect x="460" y="282" width="10" height="42" fill="#8A7B67"/>',
    '  <circle cx="150" cy="200" r="26" fill="#D6DEE3"/>',
    '  <circle cx="650" cy="175" r="18" fill="#D6DEE3"/>',
    cap('איור סכמטי — מעבר נהר'), '</svg>']

# 5 — a harbour / narrow bay
FILES['scene-harbor.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#E9F0F3"/>',
    '  <polygon points="0,200 240,200 300,380 0,380" fill="#BBC8CF"/>',
    '  <polygon points="800,200 560,200 500,380 800,380" fill="#BBC8CF"/>',
    '  <rect x="0" y="330" width="800" height="120" fill="#A9C4D2"/>',
    '  <polygon points="360,290 400,230 440,290" fill="#F2F6F8"/>',
    '  <rect x="392" y="230" width="4" height="62" fill="#7E8D99"/>',
    '  <polygon points="300,320 330,285 360,320" fill="#F2F6F8"/>',
    cap('איור סכמטי — מפרץ צר'), '</svg>']

# 6 — schematic map (abstract regions, NOT a real place)
FILES['map-schematic.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#F4F1EA"/>',
    '  <path d="M90 70 L330 50 L380 210 L200 300 L70 230 Z" fill="#D9D2C2"/>',
    '  <path d="M400 90 L690 60 L720 250 L470 300 L390 200 Z" fill="#CFC7B4"/>',
    '  <path d="M200 310 L520 320 L560 400 L180 395 Z" fill="#E1DCCE"/>',
    '  <path d="M360 60 L395 300" stroke="#A89C80" stroke-width="3" stroke-dasharray="9 7" fill="none"/>',
    '  <circle cx="230" cy="180" r="7" fill="#7E7055"/>',
    '  <circle cx="560" cy="170" r="7" fill="#7E7055"/>',
    '  <circle cx="370" cy="360" r="7" fill="#7E7055"/>',
    cap('איור סכמטי — מפת אזורים (אינה מפה אמיתית)', 430, '#8C8268'), '</svg>']

# 7 — bar chart (abstract, unlabelled axes)
FILES['chart-bars.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#F7FAFB"/>',
    '  <line x1="90" y1="370" x2="730" y2="370" stroke="#C3CDD4" stroke-width="2"/>',
    '  <line x1="90" y1="70" x2="90" y2="370" stroke="#C3CDD4" stroke-width="2"/>']
for i, h in enumerate([120, 180, 90, 230, 160, 260, 140]):
    x = 130 + i * 82
    FILES['chart-bars.svg'].append(
        '  <rect x="%d" y="%d" width="46" height="%d" rx="3" fill="#9DB7C6"/>' % (x, 370 - h, h))
FILES['chart-bars.svg'] += [cap('איור סכמטי — תרשים עמודות'), '</svg>']

# 8 — line chart (abstract)
FILES['chart-line.svg'] = [
    HEAD, NOTE,
    '  <rect width="800" height="450" fill="#F7FAFB"/>',
    '  <line x1="90" y1="370" x2="730" y2="370" stroke="#C3CDD4" stroke-width="2"/>',
    '  <line x1="90" y1="70" x2="90" y2="370" stroke="#C3CDD4" stroke-width="2"/>',
    '  <polyline points="110,320 210,250 310,280 410,170 510,210 610,120 710,150" '
    'fill="none" stroke="#7FA6BC" stroke-width="4" stroke-linejoin="round"/>',
    '  <polyline points="110,350 210,330 310,340 410,300 510,310 610,270 710,285" '
    'fill="none" stroke="#C9A98E" stroke-width="3" stroke-dasharray="7 6"/>',
    cap('איור סכמטי — תרשים מגמה'), '</svg>']

for name, parts in FILES.items():
    io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline=chr(10)).write(
        chr(10).join(parts) + chr(10))
    print('  wrote', name)

print()
print('pool now:', sorted(os.listdir(OUT)))
