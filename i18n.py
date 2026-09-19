#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SN PLUS · Preparar un modulo para traduccion
@SIN_NOMBRE22

  python3 i18n.py envolver Protocolos/sslcert.cpp
      Envuelve los textos de interfaz con t(...) y anade el include.
      Deja un respaldo .bak

  python3 i18n.py extraer Protocolos/*.cpp > lang/en.txt
      Genera el catalogo con los textos ya envueltos.

  python3 i18n.py revisar Protocolos/sslcert.cpp
      Solo muestra que textos se envolverian, sin tocar nada.
"""

import re
import sys
import os
import glob

# Funciones cuyo primer argumento de texto es visible al usuario
FUNCS = [
    "centrarTexto", "msgOK", "msgERR", "msgWARN", "msgINFO",
    "titulo", "prompt", "confirmar",
]

# Texto suelto en un std::cout entre marcas de color
PATRON_COUT = re.compile(r'(<<\s*(?:W|C|G|Y|R|N|D|BOLD)\s*<<\s*)"([^"\\]{3,})"')

# No traducir: rutas, comandos, formatos, tecnicismos
def es_traducible(s):
    if len(s.strip()) < 3:
        return False
    if s.strip() in ("\\n", " ", "  ", "    "):
        return False
    # rutas y comandos
    if s.startswith("/") or s.startswith("./"):
        return False
    for tok in ("systemctl", "iptables", "curl ", "wget ", "apt-get", "dig ",
                "grep ", "awk ", "sed ", "chmod", "chown", "mkdir", "rm -",
                "journalctl", "http://", "https://", "\\033", "%-", "%s", "%d"):
        if tok in s:
            return False
    # debe tener al menos una letra
    if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", s):
        return False
    return True


def envolver_texto(codigo):
    encontrados = []

    def rep_func(m):
        fn, txt = m.group(1), m.group(2)
        if not es_traducible(txt):
            return m.group(0)
        encontrados.append(txt)
        return f'{fn}(t("{txt}")'

    # func("texto"  ->  func(t("texto")
    patron_func = re.compile(
        r'\b(' + "|".join(FUNCS) + r')\(\s*"([^"\\]+)"'
    )
    codigo = patron_func.sub(rep_func, codigo)

    def rep_cout(m):
        pre, txt = m.group(1), m.group(2)
        if not es_traducible(txt):
            return m.group(0)
        encontrados.append(txt)
        return f'{pre}t("{txt}")'

    codigo = PATRON_COUT.sub(rep_cout, codigo)
    return codigo, encontrados


def anadir_include(codigo):
    if "sn_i18n.h" in codigo:
        return codigo
    if '#include "global/sn_lic_guard.h"' in codigo:
        return codigo.replace(
            '#include "global/sn_lic_guard.h"',
            '#include "global/sn_lic_guard.h"\n#include "global/sn_i18n.h"',
            1,
        )
    if '#include "global/sn_lines.h"' in codigo:
        return codigo.replace(
            '#include "global/sn_lines.h"',
            '#include "global/sn_lines.h"\n#include "global/sn_i18n.h"',
            1,
        )
    return '#include "global/sn_i18n.h"\n' + codigo


def cmd_envolver(ruta):
    with open(ruta, encoding="utf-8") as f:
        original = f.read()

    nuevo, encontrados = envolver_texto(original)
    nuevo = anadir_include(nuevo)

    if nuevo == original:
        print(f"{ruta}: sin cambios")
        return

    with open(ruta + ".bak", "w", encoding="utf-8") as f:
        f.write(original)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(nuevo)

    print(f"{ruta}: {len(encontrados)} textos envueltos (respaldo en {ruta}.bak)")


def cmd_revisar(ruta):
    with open(ruta, encoding="utf-8") as f:
        _, encontrados = envolver_texto(f.read())
    vistos = []
    for e in encontrados:
        if e not in vistos:
            vistos.append(e)
    print(f"# {ruta}: {len(vistos)} textos")
    for e in vistos:
        print("   ", e)


def cmd_extraer(rutas):
    textos = []
    patron = re.compile(r't\(\s*"([^"\\]+)"\s*\)')
    for ruta in rutas:
        with open(ruta, encoding="utf-8") as f:
            for m in patron.finditer(f.read()):
                if m.group(1) not in textos:
                    textos.append(m.group(1))

    print("# SN PLUS · catalogo de idioma")
    print("# :texto original")
    print("# =traduccion")
    print("#")
    print("# Si una traduccion falta, se muestra el original.")
    print()
    for txt in textos:
        print(f":{txt}")
        print(f"={txt}")
        print()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    accion = sys.argv[1]
    rutas = []
    for arg in sys.argv[2:]:
        rutas.extend(glob.glob(arg) if "*" in arg else [arg])

    rutas = [r for r in rutas if os.path.isfile(r)]
    if not rutas:
        print("No se encontraron archivos")
        sys.exit(1)

    if accion == "envolver":
        for r in rutas:
            cmd_envolver(r)
    elif accion == "revisar":
        for r in rutas:
            cmd_revisar(r)
    elif accion == "extraer":
        cmd_extraer(rutas)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
