import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import LIGHT, DARK
import a
mods = [a]
try:
    import b; mods.append(b)
except ImportError as e: print(e)
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for m in mods:
    for name, fn in m.ALL.items():
        open(os.path.join(out, name + '.svg'), 'w').write(fn(LIGHT))
        if name not in getattr(m, 'NO_DARK', ()):
            open(os.path.join(out, name + '-dark.svg'), 'w').write(fn(DARK))
print(len(os.listdir(out)), 'files')
