# Vygeneruje návrhy slunečnice, levandule, stromu a kvítku ve stejném stylu jako
# ručně kreslený tulipán a kopretina: plátno 960×960, rostlina stojí v bodě (480, 805),
# dvoubarevné listy (světlá + tmavá polovina), ploché tvary bez obrysů.
# Spuštění (ve složce web):  python3 kvetiny/generuj-zbytek.py && node kvetiny/sestav.js
import math, os

DIR = os.path.dirname(os.path.abspath(__file__))
G1, G2, G3, G4 = '#46591A', '#5C7A1F', '#7A962E', '#8FAA3C'   # zelené jako u tulipánu


def svg(title, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" width="960" height="960">\n'
            f'<title>{title}</title>\n{body}\n</svg>\n')


def leaf(x, y, rot, length, width, light, dark):
    """Dvoubarevný list z bodu (x, y), natočený o rot stupňů (0 = nahoru)."""
    L, W = length, width
    return (f'<g transform="translate({x} {y}) rotate({rot})">'
            f'<path d="M0 0 C{-W*.38:.1f} {-L*.4:.1f} {-W:.1f} {-L*.62:.1f} {-W*.8:.1f} {-L*.86:.1f} '
            f'C{-W*.5:.1f} {-L*1.03:.1f} {W*.5:.1f} {-L*1.03:.1f} {W*.8:.1f} {-L*.86:.1f} '
            f'C{W:.1f} {-L*.62:.1f} {W*.38:.1f} {-L*.4:.1f} 0 0 Z" fill="{light}"/>'
            f'<path d="M0 0 C{-W*.38:.1f} {-L*.4:.1f} {-W:.1f} {-L*.62:.1f} {-W*.8:.1f} {-L*.86:.1f} '
            f'C{-W*.5:.1f} {-L*1.02:.1f} {-W*.08:.1f} {-L*1.0:.1f} 0 {-L*.99:.1f} Z" fill="{dark}"/></g>')


def stem(path, w=10, color=G2):
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'


def sprout(scale=1.5, variant=0):
    """Klíček: dva děložní lístky a malý střední."""
    inner = (leaf(476, 805, -38 - variant * 4, 110, 26, G2, G1) + leaf(484, 805, 40, 100, 24, G3, G2)
             + leaf(480, 805, -3, 74, 15, G4, G3))
    return f'<g transform="translate(480 805) scale({scale}) translate(-480 -805)">{inner}</g>'


def ring(cx, cy, n, rx, ry, dist, fill, offset=0.0, extra=''):
    out = []
    for i in range(n):
        a = offset + 360 * i / n
        out.append(f'<ellipse cx="{cx}" cy="{cy - dist:.1f}" rx="{rx}" ry="{ry}" fill="{fill}" '
                   f'transform="rotate({a:.1f} {cx} {cy})"{extra}/>')
    return ''.join(out)


# ---------- slunečnice ----------
SUN = {'': ('#F2B33D', '#F7CB4D', '#E39A2A'), 'oranzova': ('#EE8A3C', '#F5A65E', '#D9722A')}

def sunflower(stage, variant=''):
    p1, p2, p3 = SUN[variant]
    if stage == 1:
        return sprout(1.55)
    leaves = (leaf(476, 700, -62, 170, 62, G2, G1) + leaf(486, 640, 58, 160, 58, G3, G2)
              + leaf(478, 805, -30, 120, 34, G3, G2) + leaf(484, 805, 32, 110, 32, G2, G1))
    if stage == 2:
        bud = (f'<circle cx="480" cy="408" r="40" fill="{G3}"/>'
               f'<path d="M440 408 A40 40 0 0 0 520 408 Z" fill="{G2}"/>'
               + ''.join(f'<path d="M480 368 L{480 + 22*math.sin(math.radians(a)):.1f} {408 - 46*math.cos(math.radians(a)):.1f}" '
                         f'stroke="{G1}" stroke-width="4" stroke-linecap="round" opacity=".5"/>' for a in (-60, -30, 0, 30, 60))
               + f'<path d="M462 372 C470 352 490 352 498 372 Z" fill="{p2}"/>')
        return stem('M480 800 C474 680 488 540 480 440', 14) + leaves + bud
    cx, cy = 480, 300
    # Méně lístků a mírně nepravidelné, ať slunečnice nevypadá jako razítko.
    import random
    rnd = random.Random(11)
    back = ''.join(f'<ellipse cx="{cx}" cy="{cy - 92 - rnd.uniform(-4, 6):.1f}" rx="21" ry="{rnd.uniform(52, 60):.1f}" fill="{p1}" '
                   f'transform="rotate({360 * i / 5 + 36 + rnd.uniform(-5, 5):.1f} {cx} {cy})"/>' for i in range(5))
    front = ''.join(f'<ellipse cx="{cx}" cy="{cy - 90 - rnd.uniform(-4, 8):.1f}" rx="{rnd.uniform(18, 22):.1f}" ry="{rnd.uniform(50, 60):.1f}" fill="{p2}" '
                    f'transform="rotate({360 * i / 11 + rnd.uniform(-5, 5):.1f} {cx} {cy})"/>' for i in range(11))
    head = (back + front
            + f'<circle cx="{cx}" cy="{cy}" r="66" fill="#7A4E2D"/>'
            f'<circle cx="{cx}" cy="{cy}" r="52" fill="#93613A"/>'
            f'<path d="M{cx+66} {cy} A66 66 0 0 1 {cx-46} {cy+47} A72 72 0 0 0 {cx+66} {cy} Z" fill="#5E3A20"/>'
            + ''.join(f'<circle cx="{cx + r*math.cos(math.radians(a)):.1f}" cy="{cy + r*math.sin(math.radians(a)):.1f}" r="3.2" fill="#6A4325"/>'
                      for r in (18, 34) for a in range(0, 360, 30 if r == 18 else 20))
            + f'<circle cx="{cx-16}" cy="{cy-18}" r="14" fill="#A8774A" opacity=".7"/>')
    return stem('M480 800 C472 660 490 480 480 360', 16) + leaves + head


# ---------- levandule ----------
LAV = {'': ('#9C7CC7', '#B79BDD', '#7F63AE'), 'modra': ('#7F8FD6', '#A3B0E8', '#6474BF')}
LAV_STEMS = [(-62, 0.78), (-30, 0.92), (0, 1.0), (30, 0.9), (60, 0.76)]

def lavender(stage, variant=''):
    c1, c2, c3 = LAV[variant]
    grey1, grey2 = '#7E9A6A', '#647F52'
    if stage == 1:
        blades = ''.join(leaf(480 + dx, 805, rot, L, 9, grey1, grey2)
                         for dx, rot, L in ((-6, -22, 120), (6, 20, 110), (0, -4, 150), (-10, -42, 90), (10, 44, 86)))
        return f'<g transform="translate(480 805) scale(1.45) translate(-480 -805)">{blades}</g>'
    out = ''
    for dx, h in LAV_STEMS:
        top = 805 - (430 if stage == 2 else 560) * h
        x2 = 480 + dx * (1.6 if stage == 3 else 1.2)
        out += stem(f'M{480 + dx*0.2:.1f} 800 C{480 + dx*0.5:.1f} 700 {x2:.1f} {top + 120:.1f} {x2:.1f} {top:.1f}', 7, '#6F8A4E')
        n = 6 if stage == 2 else 10
        for i in range(n):
            y = top + i * (11 if stage == 2 else 13)
            side = -1 if i % 2 else 1
            col = (c2 if i % 3 else c1) if stage == 3 else ('#C9B7DA' if i % 2 else '#B8D08A')
            rx, ry = (7, 10) if stage == 2 else (10, 14)
            out += f'<ellipse cx="{x2 + side*7:.1f}" cy="{y:.1f}" rx="{rx}" ry="{ry}" fill="{col}" transform="rotate({side*24} {x2 + side*7:.1f} {y:.1f})"/>'
        if stage == 3:
            out += f'<ellipse cx="{x2:.1f}" cy="{top - 8:.1f}" rx="8" ry="12" fill="{c3}"/>'
    base = ''.join(leaf(480 + dx, 805, rot, L, 10, grey1, grey2)
                   for dx, rot, L in ((-8, -30, 170), (8, 28, 160), (-4, -10, 200), (4, 12, 190), (-12, -52, 120), (12, 54, 116)))
    return out + base


# ---------- strom ----------
def tree(stage):
    bark1, bark2 = '#8A6447', '#6E4D35'
    if stage == 1:
        return (stem('M480 805 C478 760 484 720 480 660', 9, bark1)
                + leaf(480, 690, -50, 90, 26, G3, G2) + leaf(480, 670, 46, 84, 24, G2, G1)
                + leaf(480, 662, -4, 96, 26, G4, G3))
    if stage == 2:
        trunk = (f'<path d="M466 805 C470 720 472 640 474 560 L486 560 C488 640 490 720 494 805 Z" fill="{bark1}"/>'
                 f'<path d="M480 805 C482 720 484 640 486 560 L486 560 C488 640 490 720 494 805 Z" fill="{bark2}"/>'
                 + stem('M478 640 C460 610 440 592 424 586', 9, bark1) + stem('M482 610 C500 590 520 578 538 574', 8, bark1))
        crown = ('<circle cx="480" cy="470" r="128" fill="#6F9A5B"/>'
                 '<circle cx="404" cy="540" r="70" fill="#8DB062"/>'
                 '<circle cx="560" cy="530" r="64" fill="#5E8A4E"/>'
                 '<path d="M352 470 A128 128 0 0 1 560 370 A140 140 0 0 0 352 470 Z" fill="#A9C97A"/>'
                 '<path d="M480 598 A128 128 0 0 0 608 470 A120 120 0 0 1 480 598 Z" fill="#4F7B57" opacity=".55"/>')
        return trunk + crown
    trunk = (f'<path d="M458 805 C466 700 468 600 470 470 L490 470 C492 600 494 700 502 805 Z" fill="{bark1}"/>'
             f'<path d="M480 805 C482 700 486 600 490 470 L490 470 C492 600 494 700 502 805 Z" fill="{bark2}"/>'
             + stem('M474 600 C440 560 404 540 372 534', 13, bark1) + stem('M486 560 C520 520 560 504 592 500', 12, bark1)
             + stem('M478 520 C470 470 462 430 450 400', 10, bark1))
    crown = ('<circle cx="480" cy="330" r="190" fill="#5E8A4E"/>'
             '<circle cx="330" cy="430" r="120" fill="#7EA65A"/>'
             '<circle cx="636" cy="420" r="118" fill="#4F7B57"/>'
             '<circle cx="560" cy="230" r="110" fill="#6F9A5B"/>'
             '<circle cx="400" cy="230" r="104" fill="#8DB062"/>'
             '<path d="M296 250 A104 104 0 0 1 486 174 A118 118 0 0 0 296 250 Z" fill="#B5D184"/>'
             '<path d="M210 430 A120 120 0 0 1 380 320 A132 132 0 0 0 210 430 Z" fill="#A3C474"/>'
             '<path d="M480 520 A190 190 0 0 0 670 330 A176 176 0 0 1 480 520 Z" fill="#3E6B4C" opacity=".45"/>')
    fruit = ''.join(f'<circle cx="{x}" cy="{y}" r="15" fill="#F08F6E"/><circle cx="{x-4}" cy="{y-5}" r="5" fill="#F8C1A6"/>'
                    for x, y in ((410, 300), (548, 250), (600, 400), (346, 440), (480, 410), (650, 300), (300, 360)))
    return trunk + crown + fruit


# ---------- kvítek (pomněnka) ----------
DOT = {'': ('#7FA9D9', '#A9C8EC'), 'zluty': ('#F2C94C', '#F7DC82'), 'fialovy': ('#B48ACB', '#CDAEDD'), 'bily': ('#EDEDE2', '#FFFFFF')}

def blossom(cx, cy, r, c1, c2):
    petals = ''.join(f'<circle cx="{cx + r*0.62*math.cos(math.radians(a - 90)):.1f}" cy="{cy + r*0.62*math.sin(math.radians(a - 90)):.1f}" r="{r*0.5:.1f}" fill="{c2 if i % 2 else c1}"/>'
                     for i, a in enumerate(range(0, 360, 72)))
    return petals + f'<circle cx="{cx}" cy="{cy}" r="{r*0.28:.1f}" fill="#F5D46A"/><circle cx="{cx}" cy="{cy}" r="{r*0.12:.1f}" fill="#E39A2A"/>'

def small(stage, variant=''):
    c1, c2 = DOT[variant]
    if stage == 1:
        return sprout(1.25, 1)
    leaves = (leaf(474, 805, -58, 150, 42, G3, G2) + leaf(486, 805, 60, 140, 40, G2, G1)
              + leaf(478, 805, -24, 170, 40, G2, G1) + leaf(482, 805, 26, 160, 38, G3, G2))
    if stage == 2:
        buds = ''.join(stem(f'M480 790 C{480 + dx*.4} 720 {480 + dx} {640 + abs(dx)*.4} {480 + dx} {610 + abs(dx)*.4}', 7, G2)
                       + f'<ellipse cx="{480 + dx}" cy="{600 + abs(dx)*.4}" rx="12" ry="16" fill="#E8A9C2"/>'
                       + f'<path d="M{468 + dx} {606 + abs(dx)*.4} C{472 + dx} {622 + abs(dx)*.4} {488 + dx} {622 + abs(dx)*.4} {492 + dx} {606 + abs(dx)*.4} Z" fill="{G3}"/>'
                       for dx in (-60, 0, 60))
        return buds + leaves
    heads = [(-110, 560), (-40, 470), (40, 450), (110, 540), (0, 560), (-70, 640), (80, 630)]
    out = ''.join(stem(f'M480 790 C{480 + dx*.3:.1f} 700 {480 + dx:.1f} {y + 80} {480 + dx:.1f} {y}', 7, G2) for dx, y in heads)
    out += leaves
    out += ''.join(blossom(480 + dx, y, 44, c1, c2) for dx, y in heads)
    out += ''.join(f'<ellipse cx="{x}" cy="{y}" rx="10" ry="14" fill="#E8A9C2"/>' for x, y in ((372, 600), (590, 590), (450, 410)))
    return out


PLANTS = {
    'slunecnice': (sunflower, ['', 'oranzova'], 'Slunečnice'),
    'levandule': (lavender, ['', 'modra'], 'Levandule'),
    'strom': (tree, [''], 'Strom'),
    'kvitek': (small, ['', 'zluty', 'fialovy', 'bily'], 'Kvítek'),
}
STAGE = {1: 'klíček', 2: 'poupě', 3: 'květ'}

for name, (fn, variants, title) in PLANTS.items():
    for v in variants:
        for st in (1, 2, 3):
            body = fn(st, v) if v else fn(st)
            fname = f'{name}-{v}-{st}.svg' if v else f'{name}-{st}.svg'
            with open(os.path.join(DIR, fname), 'w') as f:
                f.write(svg(f'{title}{" " + v if v else ""} – {STAGE[st]}', body))
print('hotovo')
