#ifndef SN_LINES_H
#define SN_LINES_H

// Enlaces dinámicos al binario compilado protegido
extern "C" {
    void sn_print_linea();
    void sn_print_sep();
    const char* sn_get_linea();
    const char* sn_get_sep();
}

// Mapeo de tus macros para que no tengas que renombrar nada en tus scripts antiguos
#define SN_LINEA sn_get_linea()
#define SN_SEP   sn_get_sep()
#define SN_PRINT_LINEA sn_print_linea()
#define SN_PRINT_SEP   sn_print_sep()

#endif
