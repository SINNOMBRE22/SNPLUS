#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  SN PLUS · Instalador
#  @SIN_NOMBRE22
#
#  Sin "set -e": cada paso se valida por separado. Con set -e y un
#  spinner en segundo plano el script muere en silencio y el usuario
#  solo ve el prompt de vuelta.
#
#  Log completo:  /var/log/snplus_install.log
# ════════════════════════════════════════════════════════════════

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
C='\033[0;36m'; W='\033[1;37m'; N='\033[0m'; D='\033[2m'

REPO_RAW="https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main"
MIRRORS=(
    "https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main"
    "https://cdn.jsdelivr.net/gh/SINNOMBRE22/SNPLUS@main"
    "https://raw.fastgit.org/SINNOMBRE22/SNPLUS/main"
)

LOCK_FILE="/tmp/snplus_install.lock"
LOG_FILE="/var/log/snplus_install.log"
APT_LOCK="/var/lib/dpkg/lock-frontend"
APT_LOCK2="/var/lib/dpkg/lock"
APT_LOCK3="/var/cache/apt/archives/lock"
NET_TIMEOUT=30
MAX_WAIT_APT=180
SWAP_TMP="/swapfile_snplus"
SWAP_CREATED=0
WORKDIR=""
FILE=""
LIB_DIR="/etc/SNPLUS/Sistema/global"

export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export APT_LISTCHANGES_FRONTEND=none
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

APT_OPTS=(
    -o Dpkg::Options::="--force-confdef"
    -o Dpkg::Options::="--force-confold"
    -o APT::Get::AllowUnauthenticated=true
    -o DPkg::Lock::Timeout=60
)

# ── Log ─────────────────────────────────────────────────────────
if ! : > "$LOG_FILE" 2>/dev/null; then
    LOG_FILE="/tmp/snplus_install.log"
    : > "$LOG_FILE" 2>/dev/null || LOG_FILE="/dev/null"
fi

log()  { echo "[$(date '+%F %T')] $*" >> "$LOG_FILE" 2>/dev/null; }
ok()   { printf "    ${G}✔${N} %b\n" "$1"; log "OK: $1"; }
warn() { printf "    ${Y}!${N} %b\n" "$1"; log "AVISO: $1"; }
info() { printf "    ${C}•${N} %b\n" "$1"; log "INFO: $1"; }

cleanup() {
    printf "\033[?25h"
    [[ -n "$FILE"    ]] && rm -f "$FILE" 2>/dev/null
    [[ -n "$WORKDIR" ]] && rm -rf "$WORKDIR" 2>/dev/null
    rm -f "$LOCK_FILE" 2>/dev/null
    if [[ "$SWAP_CREATED" -eq 1 ]]; then
        swapoff "$SWAP_TMP" 2>/dev/null
        rm -f "$SWAP_TMP" 2>/dev/null
    fi
}
trap cleanup EXIT
trap 'printf "\033[?25h\n"; echo -e "${Y}Instalacion cancelada por el usuario.${N}"; exit 130' INT TERM

die() {
    printf "\033[?25h"
    echo ""
    echo -e "${R}════════════════════════════════════════${N}"
    echo -e "${R}  ERROR${N}"
    echo -e "${R}════════════════════════════════════════${N}"
    echo -e "  $1"
    [[ -n "$2" ]] && echo -e "  ${D}$2${N}"
    echo ""
    echo -e "  ${D}Log: $LOG_FILE${N}"
    if [[ -s "$LOG_FILE" ]]; then
        echo -e "  ${D}Ultimas lineas:${N}"
        tail -n 15 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
    fi
    echo ""
    exit 1
}

# ── Spinner: nunca deja el proceso colgado esperando stdin ──────
spinner() {
    local msg="$1"; shift
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local idx=0
    log "INICIO: $msg -> $*"
    printf "\033[?25l"
    "$@" >> "$LOG_FILE" 2>&1 < /dev/null &
    local pid=$!
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r    %s %s" "$msg" "${frames[$idx]}"
        idx=$(( (idx + 1) % 10 ))
        sleep 0.1
    done
    wait "$pid"; local rc=$?
    if [[ $rc -eq 0 ]]; then
        printf "\r\033[K    ${G}✔${N} %s\n" "$msg"
    else
        printf "\r\033[K    ${R}✗${N} %s\n" "$msg"
    fi
    printf "\033[?25h"
    log "FIN: $msg (rc=$rc)"
    return $rc
}

# ════════════════════════════════════════════════════════════════
#  1. ROOT
# ════════════════════════════════════════════════════════════════
if [[ "$(id -u)" -ne 0 ]]; then
    echo -e "${R}Acceso denegado.${N} Ejecute con: ${W}sudo bash install.sh${N}"
    exit 1
fi

clear
echo -e "${R}════════════════════════════════════════${N}"
echo -e "${W}          SN PLUS · INSTALADOR${N}"
echo -e "${R}════════════════════════════════════════${N}"
echo ""

# ════════════════════════════════════════════════════════════════
#  2. LOCK (limpia el huerfano de una instalacion interrumpida)
# ════════════════════════════════════════════════════════════════
if [[ -f "$LOCK_FILE" ]]; then
    old_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
        die "Ya hay una instalacion en curso (PID $old_pid)." \
            "Espera a que termine o ejecuta: kill $old_pid"
    fi
    rm -f "$LOCK_FILE"
    log "Lock huerfano eliminado"
fi
echo $$ > "$LOCK_FILE"

# ════════════════════════════════════════════════════════════════
#  3. SISTEMA
# ════════════════════════════════════════════════════════════════
DISTRO_ID=""; DISTRO_VER=""
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_VER="${VERSION_ID:-unknown}"
fi

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|amd64) ARCH_OK=1 ;;
    aarch64|arm64) ARCH_OK=2 ;;
    *) ARCH_OK=0 ;;
esac

log "===== INSTALACION ====="
log "Distro: $DISTRO_ID $DISTRO_VER | Kernel: $(uname -r) | Arch: $ARCH"
log "RAM: $(free -m 2>/dev/null | awk '/Mem:/{print $2}')MB"
log "Disco: $(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')MB libres"

info "Sistema:  ${W}${DISTRO_ID} ${DISTRO_VER}${N}  (${ARCH})"

if [[ $ARCH_OK -eq 0 ]]; then
    die "Arquitectura no soportada: $ARCH" \
        "SN PLUS requiere x86_64 (amd64) o aarch64 (arm64)."
fi
if [[ $ARCH_OK -eq 2 ]]; then
    warn "Arquitectura ARM detectada. Algunos protocolos podrian no funcionar."
fi

case "$DISTRO_ID" in
    ubuntu|debian) ;;
    "") warn "No se pudo identificar la distribucion. Se continuara igual." ;;
    *)  warn "Distribucion no probada: $DISTRO_ID. Se continuara igual." ;;
esac

# systemd: casi todos los modulos crean servicios
if ! command -v systemctl &>/dev/null; then
    warn "systemd no disponible (contenedor?). Los servicios no arrancaran solos."
fi

# ════════════════════════════════════════════════════════════════
#  4. FECHA/HORA  (si esta mal, todo TLS falla)
# ════════════════════════════════════════════════════════════════
ANIO=$(date +%Y 2>/dev/null)
if [[ -n "$ANIO" ]] && { [[ "$ANIO" -lt 2024 ]] || [[ "$ANIO" -gt 2100 ]]; }; then
    warn "Fecha del sistema incorrecta ($(date '+%F')). Corrigiendo..."
    systemctl start systemd-timesyncd >/dev/null 2>&1
    timedatectl set-ntp true >/dev/null 2>&1
    sleep 3
    ANIO=$(date +%Y)
    if [[ "$ANIO" -lt 2024 ]]; then
        die "La fecha del sistema es incorrecta: $(date '+%F')" \
            "Las descargas HTTPS fallaran. Corrigela con: timedatectl set-time 'AAAA-MM-DD HH:MM:SS'"
    fi
    ok "Fecha corregida: $(date '+%F %T')"
fi

# ════════════════════════════════════════════════════════════════
#  5. CONECTIVIDAD
# ════════════════════════════════════════════════════════════════
probar_red() {
    local destinos=("1.1.1.1" "8.8.8.8" "9.9.9.9")
    for d in "${destinos[@]}"; do
        if timeout 5 bash -c "echo > /dev/tcp/$d/53" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

if ! probar_red; then
    die "Sin conexion a internet." \
        "Comprueba la red del VPS:  ping 1.1.1.1"
fi

if ! getent hosts github.com >/dev/null 2>&1 && \
   ! getent hosts raw.githubusercontent.com >/dev/null 2>&1; then
    warn "El DNS no resuelve github.com. Aplicando DNS publico..."
    cp /etc/resolv.conf /etc/resolv.conf.snplus.bak 2>/dev/null
    printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > /etc/resolv.conf 2>/dev/null
    if ! getent hosts raw.githubusercontent.com >/dev/null 2>&1; then
        die "El DNS del VPS no resuelve dominios." \
            "Revisa /etc/resolv.conf o contacta a tu proveedor."
    fi
    ok "DNS corregido"
fi
ok "Conexion a internet"

# ════════════════════════════════════════════════════════════════
#  6. ESPACIO EN DISCO
# ════════════════════════════════════════════════════════════════
DISK_FREE=$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')
if [[ -n "$DISK_FREE" ]] && [[ "$DISK_FREE" -lt 700 ]]; then
    warn "Poco espacio libre (${DISK_FREE}MB). Liberando..."
    apt-get clean >> "$LOG_FILE" 2>&1
    rm -rf /var/lib/apt/lists/* /var/log/*.gz /var/log/*.1 2>/dev/null
    journalctl --vacuum-size=20M >> "$LOG_FILE" 2>&1
    DISK_FREE=$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')
    if [[ "$DISK_FREE" -lt 300 ]]; then
        die "Espacio insuficiente en disco: ${DISK_FREE}MB libres." \
            "SN PLUS necesita al menos 300MB. Libera espacio y reintenta."
    fi
fi
ok "Espacio en disco: ${DISK_FREE}MB"

# ════════════════════════════════════════════════════════════════
#  7. SWAP TEMPORAL  (evita que el OOM killer mate la instalacion)
# ════════════════════════════════════════════════════════════════
RAM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/{print $2}')
SWAP_TOTAL=$(free -m 2>/dev/null | awk '/Swap:/{print $2}')
if [[ -n "$RAM_TOTAL" ]] && [[ "$RAM_TOTAL" -lt 1200 ]] && [[ "${SWAP_TOTAL:-0}" -lt 100 ]]; then
    if [[ "$DISK_FREE" -gt 1500 ]]; then
        if fallocate -l 1G "$SWAP_TMP" >> "$LOG_FILE" 2>&1 || \
           dd if=/dev/zero of="$SWAP_TMP" bs=1M count=1024 >> "$LOG_FILE" 2>&1; then
            chmod 600 "$SWAP_TMP"
            mkswap "$SWAP_TMP" >> "$LOG_FILE" 2>&1
            if swapon "$SWAP_TMP" >> "$LOG_FILE" 2>&1; then
                SWAP_CREATED=1
                ok "Swap temporal 1G (RAM: ${RAM_TOTAL}MB)"
            else
                rm -f "$SWAP_TMP"
            fi
        else
            rm -f "$SWAP_TMP"
        fi
    else
        warn "RAM baja (${RAM_TOTAL}MB) y sin espacio para swap temporal."
    fi
fi

# ════════════════════════════════════════════════════════════════
#  8. DIRECTORIO DE TRABAJO  (/tmp puede estar montado noexec)
# ════════════════════════════════════════════════════════════════
for base in /tmp /var/tmp /root; do
    [[ -d "$base" ]] || continue
    probe="$base/.sn_exec_$$"
    printf '#!/bin/sh\nexit 0\n' > "$probe" 2>/dev/null || continue
    chmod +x "$probe" 2>/dev/null
    if "$probe" 2>/dev/null; then
        rm -f "$probe"
        WORKDIR="$base/.snplus_$$"
        break
    fi
    rm -f "$probe"
done
[[ -z "$WORKDIR" ]] && die "No hay ningun directorio donde ejecutar binarios." \
                           "/tmp, /var/tmp y /root estan montados con noexec."
mkdir -p "$WORKDIR" || die "No se pudo crear el directorio temporal."
FILE="$WORKDIR/install"
log "Directorio de trabajo: $WORKDIR"

# ════════════════════════════════════════════════════════════════
#  9. APT
# ════════════════════════════════════════════════════════════════
wait_apt() {
    local waited=0
    command -v fuser &>/dev/null || return 0
    while fuser "$APT_LOCK" &>/dev/null || fuser "$APT_LOCK2" &>/dev/null || \
          fuser "$APT_LOCK3" &>/dev/null; do
        if [[ "$waited" -ge "$MAX_WAIT_APT" ]]; then
            log "Timeout esperando apt, liberando locks"
            systemctl stop unattended-upgrades >> "$LOG_FILE" 2>&1
            pkill -9 -f "apt-get|apt.systemd|unattended" >> "$LOG_FILE" 2>&1
            rm -f "$APT_LOCK" "$APT_LOCK2" "$APT_LOCK3" 2>/dev/null
            dpkg --configure -a >> "$LOG_FILE" 2>&1
            break
        fi
        [[ $waited -eq 0 ]] && info "Esperando a que apt se libere..."
        sleep 3; waited=$(( waited + 3 ))
    done
    return 0
}

echo ""
info "Preparando el sistema..."

systemctl stop unattended-upgrades apt-daily.service apt-daily-upgrade.service >> "$LOG_FILE" 2>&1
systemctl kill --kill-who=all apt-daily.service >> "$LOG_FILE" 2>&1

wait_apt
if [[ -n "$(dpkg -l 2>/dev/null | awk '/^i[^i]/{print}')" ]]; then
    spinner "Reparando dpkg" dpkg --configure -a
fi

wait_apt
if ! spinner "Actualizando repositorios" apt-get update -y -q "${APT_OPTS[@]}"; then
    warn "Fallo apt-get update. Reintentando con la cache limpia..."
    rm -rf /var/lib/apt/lists/* 2>/dev/null
    wait_apt
    if ! spinner "Actualizando repositorios (reintento)" apt-get update -y -q "${APT_OPTS[@]}"; then
        warn "apt-get update sigue fallando. Se continua: las dependencias"
        warn "podrian no instalarse, pero el panel puede funcionar igual."
    fi
fi

wait_apt
spinner "Reparando dependencias" apt-get -f install -y -q "${APT_OPTS[@]}"

wait_apt
if ! spinner "Actualizando paquetes" apt-get upgrade -y -q --no-install-recommends "${APT_OPTS[@]}"; then
    warn "Upgrade incompleto. No es critico, se continua."
    wait_apt
    dpkg --configure -a >> "$LOG_FILE" 2>&1
fi

# ── Dependencias base ───────────────────────────────────────────
wait_apt
spinner "Instalando dependencias" apt-get install -y -q --no-install-recommends \
    "${APT_OPTS[@]}" wget curl ca-certificates psmisc iptables lsof \
    net-tools unzip tar gzip coreutils

# Certificados al dia: sin esto, HTTPS puede fallar en imagenes viejas
update-ca-certificates >> "$LOG_FILE" 2>&1

if ! command -v wget &>/dev/null && ! command -v curl &>/dev/null; then
    die "No hay wget ni curl y no se pudieron instalar." \
        "Instala uno manualmente:  apt-get install -y curl"
fi

# ════════════════════════════════════════════════════════════════
# 10. FIREWALL
# ════════════════════════════════════════════════════════════════
for svc in ufw firewalld; do
    systemctl stop "$svc" &>/dev/null
    systemctl disable "$svc" &>/dev/null
done
iptables -P INPUT ACCEPT 2>/dev/null
iptables -P FORWARD ACCEPT 2>/dev/null
iptables -P OUTPUT ACCEPT 2>/dev/null
iptables -F 2>/dev/null
iptables -t nat -F 2>/dev/null
iptables -t mangle -F 2>/dev/null
ip6tables -F 2>/dev/null
nft flush ruleset 2>/dev/null
ok "Firewall desactivado"

# ════════════════════════════════════════════════════════════════
# 11. DESCARGA  (mirrors + reintentos + validacion)
# ════════════════════════════════════════════════════════════════
descargar() {
    # $1 ruta remota   $2 destino   $3 bytes minimos   $4 etiqueta
    local remoto="$1" destino="$2" minimo="$3" etiqueta="$4"
    local intento mirror url cmd

    for mirror in "${MIRRORS[@]}"; do
        for intento in 1 2; do
            url="${mirror}/${remoto}"
            log "Descargando: $url (intento $intento)"

            if command -v wget &>/dev/null; then
                cmd="wget -q -4 --timeout=$NET_TIMEOUT --tries=1 --no-cache \
                     -O '$destino' '$url'"
            else
                cmd="curl -fsSL -4 --connect-timeout 15 --max-time $NET_TIMEOUT \
                     -o '$destino' '$url'"
            fi

            if spinner "$etiqueta" bash -c "$cmd"; then
                if [[ -s "$destino" ]]; then
                    local size
                    size=$(stat -c%s "$destino" 2>/dev/null || echo 0)
                    if [[ "$size" -ge "$minimo" ]]; then
                        log "Descarga OK: $size bytes"
                        return 0
                    fi
                    log "Archivo demasiado pequeno: $size < $minimo"
                fi
            fi
            rm -f "$destino" 2>/dev/null
            sleep 1
        done
        log "Mirror agotado: $mirror"
    done
    return 1
}

echo ""
info "Descargando componentes..."

# ── Libreria global ──
mkdir -p "$LIB_DIR" || die "No se pudo crear $LIB_DIR"
if [[ ! -s "$LIB_DIR/libsn_global.so" ]]; then
    if ! descargar "Sistema/global/libsn_global.so" "$LIB_DIR/libsn_global.so" \
                   5000 "Libreria global"; then
        die "No se pudo descargar la libreria global." \
            "Comprueba que el VPS pueda salir al 443:  curl -I https://raw.githubusercontent.com"
    fi
fi
chmod 755 "$LIB_DIR/libsn_global.so"
chown root:root "$LIB_DIR/libsn_global.so" 2>/dev/null

# Validar que sea un ELF de verdad
if ! head -c 4 "$LIB_DIR/libsn_global.so" | grep -q $'\x7fELF'; then
    rm -f "$LIB_DIR/libsn_global.so"
    die "La libreria descargada esta corrupta." \
        "Puede haber un proxy o portal cautivo interceptando las descargas."
fi

echo "$LIB_DIR" > /etc/ld.so.conf.d/snplus.conf
ldconfig >> "$LOG_FILE" 2>&1
export LD_LIBRARY_PATH="$LIB_DIR:$LD_LIBRARY_PATH"

# ── Binario instalador ──
if ! descargar "install" "$FILE" 10000 "Instalador"; then
    die "No se pudo descargar el instalador." \
        "Revisa la conectividad:  curl -I https://raw.githubusercontent.com"
fi

chmod +x "$FILE"

if ! head -c 4 "$FILE" | grep -q $'\x7fELF'; then
    log "Contenido inesperado: $(head -c 200 "$FILE")"
    die "El archivo descargado no es un ejecutable valido." \
        "Puede ser una pagina de error del repositorio o un proxy interceptando."
fi

# GLIBC: aviso temprano en vez de un fallo confuso
if command -v ldd &>/dev/null; then
    missing=$(ldd "$FILE" 2>&1 | grep -i "not found")
    if [[ -n "$missing" ]]; then
        log "Dependencias faltantes: $missing"
        warn "El binario pide librerias que este sistema no tiene:"
        echo "$missing" | sed 's/^/        /'
        warn "Puede que necesites una version compilada para $DISTRO_ID $DISTRO_VER."
    fi
fi

ok "Componentes verificados"

# ════════════════════════════════════════════════════════════════
# 12. EJECUCION
# ════════════════════════════════════════════════════════════════
# El swap temporal se libera antes: el instalador ya no compila nada.
if [[ "$SWAP_CREATED" -eq 1 ]]; then
    swapoff "$SWAP_TMP" >> "$LOG_FILE" 2>&1
    rm -f "$SWAP_TMP"
    SWAP_CREATED=0
    log "Swap temporal liberado"
fi

echo ""
echo -e "${R}════════════════════════════════════════${N}"
echo ""

# SN_LIC_IP solo existe en modo prueba del panel; en una instalacion
# normal la variable no esta definida y no cambia nada.
SN_LIC_IP="${SN_LIC_IP:-}" "$FILE"
exit_code=$?

echo ""
if [[ $exit_code -ne 0 ]]; then
    echo -e "${R}El instalador termino con codigo $exit_code${N}"
    echo -e "${D}Log: $LOG_FILE${N}"
    exit "$exit_code"
fi

echo -e "${G}════════════════════════════════════════${N}"
echo -e "${G}  Instalacion completada${N}"
echo -e "${G}════════════════════════════════════════${N}"
echo -e "  Escribe ${W}sn${N} para abrir el panel."
echo ""
log "Instalacion completada correctamente"
exit 0
