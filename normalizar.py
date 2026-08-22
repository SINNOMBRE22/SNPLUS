#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SN PLUS · Normalizador de modulos
@SIN_NOMBRE22

Aplica el estandar del panel a un modulo .cpp:

  1. Anade los includes globales (sn_lines, sn_lic_guard, sn_i18n)
  2. Sustituye hr()/sep() propios por sn_print_linea()/sn_print_sep()
  3. Reemplaza la verificacion de licencia por sn_require_license()
  4. Elimina MY_DEV_IP y LIC_PATH del codigo distribuido
  5. Cambia std::signal por sigaction (SIGINT/SIGTERM/SIGHUP)
  6. Anade hideCursor()/showCursor()
  7. clearScreen con limpieza de scrollback
  8. centrarTexto contando UTF-8 (sn_len) en vez de bytes
  9. Envuelve los textos de interfaz con t(...)

USO:
  python3 normalizar.py revisar  Herramientas/dns.cpp
  python3 normalizar.py aplicar  Herramientas/*.cpp
  python3 normalizar.py aplicar  Herramientas/dns.cpp --sin-i18n

Deja respaldo .bak de cada archivo modificado.
"""

import re
import sys
import os
import glob

CAMBIOS = []


def log(f, msg):
    CAMBIOS.append((f, msg))


# ══════════════════════════════════════════════════════════
#  1. INCLUDES GLOBALES
# ══════════════════════════════════════════════════════════
def poner_includes(s, f, con_i18n=True):
    necesarios = []
    if 'global/sn_lines.h' not in s:
        necesarios.append('#include "global/sn_lines.h"')
    if 'global/sn_lic_guard.h' not in s:
        necesarios.append('#include "global/sn_lic_guard.h"')
    if con_i18n and 'global/sn_i18n.h' not in s:
        necesarios.append('#include "global/sn_i18n.h"')

    if not necesarios:
        return s

    # Insertar antes del primer #include del sistema
    m = re.search(r'^#include <', s, re.M)
    if m:
        s = s[:m.start()] + "\n".join(necesarios) + "\n\n" + s[m.start():]
    else:
        s = "\n".join(necesarios) + "\n\n" + s

    # Quitar includes globales duplicados que quedaron mas abajo
    for inc in ['global/sn_lic_guard.h', 'global/sn_lines.h', 'global/sn_i18n.h']:
        partes = s.split(f'#include "{inc}"')
        if len(partes) > 2:
            s = partes[0] + f'#include "{inc}"' + "".join(partes[1:])

    log(f, f"includes globales: {len(necesarios)} anadidos")
    return s


# ══════════════════════════════════════════════════════════
#  2. LINEAS DE LA LIBRERIA
# ══════════════════════════════════════════════════════════
def usar_lineas_globales(s, f):
    orig = s

    # hr() propio -> sn_print_linea()  (un solo patron, evita "inline inline")
    s = re.sub(
        r'(?:static\s+)?(?:inline\s+)?void\s+hr\s*\(\s*\)\s*\{[^}]*\}',
        'inline void hr()  { sn_print_linea(); }', s)

    # sep() propio -> sn_print_sep()
    s = re.sub(
        r'(?:static\s+)?(?:inline\s+)?void\s+sep\s*\(\s*\)\s*\{[^}]*\}',
        'inline void sep() { sn_print_sep(); }', s)

    # hr2()/dbl() decorativos tambien pasan a la libreria
    s = re.sub(
        r'(?:static\s+)?(?:inline\s+)?void\s+(hr2|dbl)\s*\(\s*\)\s*\{[^}]*\}',
        r'inline void \1() { sn_print_sep(); }', s)

    if s != orig:
        log(f, "hr()/sep() ahora usan libsn_global")
    return s


# ══════════════════════════════════════════════════════════
#  3. LICENCIA ESTANDAR
# ══════════════════════════════════════════════════════════
def licencia_estandar(s, f):
    orig = s

    # Quitar constantes de licencia hardcodeadas
    s = re.sub(r'^\s*static\s+const\s+std::string\s+MY_DEV_IP\s*=.*?;\s*$\n?',
               '', s, flags=re.M)
    s = re.sub(r'^\s*static\s+const\s+std::string\s+LIC_PATH\s*=.*?;\s*$\n?',
               '', s, flags=re.M)
    s = re.sub(r'^\s*const\s+std::string\s+LIC_PATH\s*=.*?;\s*$\n?',
               '', s, flags=re.M)

    # Reemplazar el cuerpo de checkLicense por el guard estandar
    patron = re.compile(
        r'static\s+void\s+checkLicense\s*\(\s*\)\s*\{.*?\n\}', re.S)
    nuevo = ('static void checkLicense() {\n'
             '    sn_require_license();\n'
             '}')
    if patron.search(s):
        s = patron.sub(nuevo, s)
        log(f, "checkLicense() usa sn_require_license()")

    if s != orig and 'MY_DEV_IP' not in s:
        log(f, "MY_DEV_IP eliminada")
    return s


# ══════════════════════════════════════════════════════════
#  4. SEÑALES CON SIGACTION
# ══════════════════════════════════════════════════════════
def señales_sigaction(s, f):
    if 'sigaction(SIGINT' in s:
        return s

    patron = re.compile(
        r'std::signal\s*\(\s*SIGINT\s*,\s*(\w+)\s*\)\s*;\s*\n'
        r'\s*std::signal\s*\(\s*SIGTERM\s*,\s*\1\s*\)\s*;')
    m = patron.search(s)
    if not m:
        return s

    handler = m.group(1)
    bloque = (
        'struct sigaction sa;\n'
        '    std::memset(&sa, 0, sizeof(sa));\n'
        f'    sa.sa_handler = {handler};\n'
        '    sigemptyset(&sa.sa_mask);\n'
        '    sa.sa_flags = 0;\n'
        '    sigaction(SIGINT,  &sa, nullptr);\n'
        '    sigaction(SIGTERM, &sa, nullptr);\n'
        '    sigaction(SIGHUP,  &sa, nullptr);'
    )
    s = patron.sub(bloque, s, count=1)

    if '#include <cstring>' not in s:
        s = s.replace('#include <csignal>', '#include <csignal>\n#include <cstring>', 1)

    log(f, "sigaction con SIGINT/SIGTERM/SIGHUP")
    return s


# ══════════════════════════════════════════════════════════
#  5. CURSOR Y PANTALLA
# ══════════════════════════════════════════════════════════
def cursor_y_pantalla(s, f):
    orig = s

    # clearScreen debe limpiar tambien el scrollback
    s = re.sub(
        r'(?:static\s+)?(?:inline\s+)?void\s+clearScreen\s*\(\s*\)\s*\{[^}]*\}',
        'inline void clearScreen() { std::cout << "\\033[2J\\033[3J\\033[1;1H" << std::flush; }',
        s)

    # Anadir hideCursor/showCursor si faltan
    if 'void hideCursor' not in s and 'inline void clearScreen' in s:
        s = s.replace(
            'inline void clearScreen()',
            'inline void hideCursor() { std::cout << "\\033[?25l" << std::flush; }\n'
            'inline void showCursor() { std::cout << "\\033[?25h" << std::flush; }\n'
            'inline void clearScreen()', 1)
        log(f, "hideCursor/showCursor anadidos")

    if s != orig:
        log(f, "clearScreen limpia scrollback")
    return s


# ══════════════════════════════════════════════════════════
#  6. CENTRADO UTF-8
# ══════════════════════════════════════════════════════════
def centrado_utf8(s, f):
    orig = s
    s = s.replace('(ancho - static_cast<int>(texto.size())) / 2',
                  '(ancho - static_cast<int>(sn_len(texto))) / 2')
    s = s.replace('(ancho - (int)texto.size()) / 2',
                  '(ancho - (int)sn_len(texto)) / 2')
    if s != orig:
        log(f, "centrarTexto cuenta caracteres UTF-8")
    return s


# ══════════════════════════════════════════════════════════
#  7. TRADUCCION
# ══════════════════════════════════════════════════════════
FUNCS_T = ["centrarTexto", "msgOK", "msgERR", "msgWARN", "msgINFO",
           "titulo", "showTitle", "prompt", "confirmar", "seccion"]

PATRON_COUT = re.compile(
    r'(<<\s*(?:W|C|G|Y|R|N|D|BOLD|Cy|M)\s*<<\s*)"([^"\\]{4,})"')

# Macros de menu del panel: MOPT_DUAL("1","TEXTO","5","TEXTO")
# y MOPT_FIXED("1","TEXTO"). El texto va en las posiciones pares.
PATRON_MOPT = re.compile(
    r'\b(MOPT_DUAL|MOPT_FIXED|MOPT|OPT_DUAL|OPT_FIXED)\s*\(([^;]*?)\)\s*;')

# printf con %-Ns: el literal traducible va como argumento
PATRON_PRINTF = re.compile(r'(printf\s*\([^;]*?,\s*)"([^"\\]{4,})"')

# Tablas de opciones:  {"7", "TEXTO"},   {"7", std::string(G) + "TEXTO" + N},
# El primer campo es el numero de opcion y no se traduce.
PATRON_TABLA = re.compile(r'(\{\s*"[0-9]{1,3}"\s*,\s*)([^}]*?)(\s*\})')


def traducible(txt):
    t = txt.strip()
    if len(t) < 4:
        return False
    if t.startswith("/") or t.startswith("./"):
        return False
    malos = ("systemctl", "iptables", "curl ", "wget ", "apt-get", "dig ",
             "grep ", "awk ", "sed ", "chmod", "chown", "mkdir", "rm -",
             "journalctl", "http://", "https://", "\\033", "%-", "%s", "%d",
             "sysctl", "/etc/", "/proc/", "/var/", "/tmp/", "/usr/",
             "net.ipv4", "net.core", "vm.")
    for m in malos:
        if m in t:
            return False
    if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", t):
        return False
    return True


def envolver_t(s, f):
    n = [0]

    def rep_func(m):
        fn, txt = m.group(1), m.group(2)
        if not traducible(txt):
            return m.group(0)
        n[0] += 1
        return f'{fn}(t("{txt}")'

    s = re.compile(r'\b(' + "|".join(FUNCS_T) + r')\(\s*"([^"\\]+)"').sub(rep_func, s)

    def rep_cout(m):
        pre, txt = m.group(1), m.group(2)
        if not traducible(txt):
            return m.group(0)
        n[0] += 1
        return f'{pre}t("{txt}")'

    s = PATRON_COUT.sub(rep_cout, s)

    # ── Macros MOPT_* ──
    def rep_mopt(m):
        macro, args = m.group(1), m.group(2)
        # Se envuelve cada literal que no sea el numero de opcion
        def rep_arg(a):
            txt = a.group(1)
            if not traducible(txt):
                return a.group(0)
            # Los numeros de opcion ("1", "01", "99") se dejan
            if txt.strip().isdigit():
                return a.group(0)
            n[0] += 1
            # .c_str() por seguridad: si la macro usa printf, un
            # std::string la romperia. Con cout tambien funciona.
            return f't("{txt}").c_str()'
        nuevos = re.sub(r'"([^"\\]+)"', rep_arg, args)
        return f'{macro}({nuevos});'

    s = PATRON_MOPT.sub(rep_mopt, s)

    # ── printf con literales ──
    def rep_printf(m):
        pre, txt = m.group(1), m.group(2)
        if not traducible(txt) or '%' in txt:
            return m.group(0)
        n[0] += 1
        return f'{pre}t("{txt}").c_str()'

    s = PATRON_PRINTF.sub(rep_printf, s)

    # ── Tablas de opciones {"7", "TEXTO"} ──
    def rep_tabla(m):
        cab, cuerpo, fin = m.group(1), m.group(2), m.group(3)
        if 't("' in cuerpo:            # ya envuelto
            return m.group(0)

        def rep_lit(a):
            txt = a.group(1)
            if not traducible(txt):
                return a.group(0)
            n[0] += 1
            return f't("{txt}")'

        nuevo = re.sub(r'"([^"\\]+)"', rep_lit, cuerpo)
        # Literal suelto sin std::string: se convierte para poder concatenar
        if nuevo != cuerpo and 'std::string' not in nuevo:
            nuevo = nuevo.strip()
        return f'{cab}{nuevo}{fin}'

    s = PATRON_TABLA.sub(rep_tabla, s)

    if n[0]:
        log(f, f"{n[0]} textos envueltos con t()")
    return s


# ══════════════════════════════════════════════════════════
#  PIPELINE
# ══════════════════════════════════════════════════════════
def normalizar(ruta, con_i18n=True):
    with open(ruta, encoding="utf-8") as fh:
        original = fh.read()

    s = original
    nombre = os.path.basename(ruta)

    s = poner_includes(s, nombre, con_i18n)
    s = usar_lineas_globales(s, nombre)
    s = licencia_estandar(s, nombre)
    s = señales_sigaction(s, nombre)
    s = cursor_y_pantalla(s, nombre)
    s = centrado_utf8(s, nombre)
    if con_i18n:
        s = envolver_t(s, nombre)

    return original, s


def cmd_revisar(rutas, con_i18n):
    for r in rutas:
        CAMBIOS.clear()
        original, nuevo = normalizar(r, con_i18n)
        print(f"\n── {r}")
        if original == nuevo:
            print("   sin cambios")
            continue
        for _, msg in CAMBIOS:
            print(f"   • {msg}")


def cmd_aplicar(rutas, con_i18n):
    for r in rutas:
        CAMBIOS.clear()
        original, nuevo = normalizar(r, con_i18n)
        if original == nuevo:
            print(f"{r}: sin cambios")
            continue
        with open(r + ".bak", "w", encoding="utf-8") as fh:
            fh.write(original)
        with open(r, "w", encoding="utf-8") as fh:
            fh.write(nuevo)
        print(f"{r}:")
        for _, msg in CAMBIOS:
            print(f"   • {msg}")
        print(f"   respaldo: {r}.bak")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    accion = sys.argv[1]
    con_i18n = "--sin-i18n" not in sys.argv

    rutas = []
    for arg in sys.argv[2:]:
        if arg.startswith("--"):
            continue
        rutas.extend(glob.glob(arg) if "*" in arg else [arg])
    rutas = [r for r in rutas if os.path.isfile(r) and r.endswith(".cpp")]

    if not rutas:
        print("No se encontraron archivos .cpp")
        sys.exit(1)

    if accion == "revisar":
        cmd_revisar(rutas, con_i18n)
    elif accion == "aplicar":
        cmd_aplicar(rutas, con_i18n)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
