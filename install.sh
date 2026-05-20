#!/bin/bash

# install.sh — SN PLUS v4.4
# Autor: SINNOMBRE22

# ── Colores (mismo namespace que Col:: en install.cpp) ────────
R='\033[0;31m'   # rojo        — Col::R
G='\033[0;32m'   # verde       — Col::G
Y='\033[1;33m'   # amarillo    — Col::Y
C='\033[0;36m'   # cyan        — Col::C
W='\033[1;37m'   # blanco bold — Col::W
N='\033[0m'      # reset       — Col::N
D='\033[2m'      # dim         — Col::D
B='\033[1m'      # bold        — Col::B

# ── Variables ─────────────────────────────────────────────────
URL="https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main/install"
FILE="/tmp/snplus_bin_$$"
LOCK_FILE="/tmp/snplus_install.lock"
APT_LOCK="/var/lib/dpkg/lock-frontend"
APT_LOCK2="/var/lib/dpkg/lock"
APT_LOCK3="/var/cache/apt/archives/lock"
WGET_TIMEOUT=30
MAX_WAIT_APT=180
DISTRO_ID=""
DISTRO_VER=""

export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export APT_LISTCHANGES_FRONTEND=none

APT_OPTS=(
    -o Dpkg::Options::="--force-confdef"
    -o Dpkg::Options::="--force-confold"
    -o APT::Get::AllowUnauthenticated=true
    -o DPkg::Lock::Timeout=60
)

cleanup() { rm -f "$FILE" "$LOCK_FILE"; }
trap cleanup EXIT INT TERM

# ── Helpers ───────────────────────────────────────────────────
_cols() {
    local c; c=$(tput cols 2>/dev/null || echo 72)
    [[ $c -gt 72 ]] && echo 72 || echo "$c"
}

_center() {
    local text="$1"
    local cols; cols=$(_cols)
    local clean; clean=$(printf '%b' "$text" | sed 's/\x1b\[[0-9;]*m//g')
    local len=${#clean}
    local pad=$(( (cols - len) / 2 ))
    [[ $pad -lt 0 ]] && pad=0
    printf "%${pad}s" ""
    printf '%b\n' "$text"
}

_hide_cursor() { printf '\033[?25l'; }
_show_cursor() { printf '\033[?25h'; }
_clear()       { printf '\033[2J\033[H'; }

_warn()  { printf '  %b⚠%b %s\n' "$Y" "$N" "$1"; }
_error() { printf '  %b✖%b %s\n' "$R" "$N" "$1"; }

# ── Líneas decorativas (mismo diseño que install.cpp) ─────────
line_slash() {
    local cols; cols=$(_cols)
    local mid=" / / / "
    local side=$(( (cols - ${#mid}) / 2 ))
    local seg; seg=$(printf '═%.0s' $(seq 1 "$side"))
    printf '%b%s%b%s%b%s%b\n' "$R" "$seg" "$W" "$mid" "$R" "$seg" "$N"
}

line_arrow() {
    local cols; cols=$(_cols)
    local inner=$(( cols - 2 ))
    local seg; seg=$(printf '━%.0s' $(seq 1 "$inner"))
    printf '%b◀%s▶%b\n' "$G" "$seg" "$N"
}

# ── Cabeceras (mismo diseño que phaseHeader / phaseOk C++) ────
phase_header() {
    local title="$1" subtitle="${2:-}"
    _clear
    printf '\n'
    line_slash
    printf '\n'
    _center "${B}${W}${title}${N}"
    [[ -n "$subtitle" ]] && _center "${D}${subtitle}${N}"
    printf '\n'
    line_slash
    printf '\n'
}

phase_ok() {
    printf '\n'
    line_arrow
    _center "${G}${B}✔  $1${N}"
    line_arrow
    printf '\n'
    sleep 0.9
}

# ── Status row (mismo diseño que statusRow C++) ───────────────
status_row() {
    local ok="$1" label="$2" detail="${3:-}"
    if [[ "$ok" == "1" ]]; then
        printf '  %b▶%b %-26s %b[✔]%b' "$G" "$N" "$label" "$G" "$N"
    else
        printf '  %b▶%b %-26s %b[!]%b' "$Y" "$N" "$label" "$Y" "$N"
    fi
    [[ -n "$detail" ]] && printf ' %b%s%b' "$D" "$detail" "$N"
    printf '\n'
}

# ── Spinner (mismo diseño que spinnerWait C++) ────────────────
spinner_run() {
    local msg="$1"; shift
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local idx=0

    _hide_cursor
    "$@" >/dev/null 2>&1 &
    local BG_PID=$!

    while kill -0 "$BG_PID" 2>/dev/null; do
        local pad=$(( 26 - ${#msg} ))
        [[ $pad -lt 0 ]] && pad=0
        printf '\r\033[K  %b▶%b %b%s%b%*s %b[%s]%b' \
            "$C" "$N" "$W" "$msg" "$N" "$pad" "" "$C" "${frames[$idx]}" "$N"
        idx=$(( (idx + 1) % 10 ))
        sleep 0.1
    done

    wait "$BG_PID"
    local rc=$?
    local pad=$(( 26 - ${#msg} ))
    [[ $pad -lt 0 ]] && pad=0
    if [[ $rc -eq 0 ]]; then
        printf '\r\033[K  %b▶%b %b%s%b%*s %b[✔]%b\n' \
            "$G" "$N" "$W" "$msg" "$N" "$pad" "" "$G" "$N"
    else
        printf '\r\033[K  %b▶%b %b%s%b%*s %b[✗]%b\n' \
            "$R" "$N" "$W" "$msg" "$N" "$pad" "" "$R" "$N"
    fi
    _show_cursor
    return $rc
}

# ══════════════════════════════════════════════════════════════
#   VERIFICAR ROOT
# ══════════════════════════════════════════════════════════════
check_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        _clear
        printf '\n'
        line_slash
        printf '\n'
        _center "${B}${R}ACCESO DENEGADO${N}"
        _center "${D}Este instalador requiere permisos de root${N}"
        printf '\n'
        line_slash
        printf '\n'
        _center "Ejecute:  ${Y}sudo bash install.sh${N}"
        printf '\n'
        exit 1
    fi
}

# ══════════════════════════════════════════════════════════════
#   LOCK
# ══════════════════════════════════════════════════════════════
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local PID_VIEJO; PID_VIEJO=$(cat "$LOCK_FILE")
        if kill -0 "$PID_VIEJO" 2>/dev/null; then
            printf '\n'
            line_slash
            printf '\n'
            _center "${Y}SNPLUS ya está en ejecución (PID $PID_VIEJO)${N}"
            printf '\n'
            line_slash
            printf '\n'
            exit 1
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

# ══════════════════════════════════════════════════════════════
#   DETECTAR DISTRO
# ══════════════════════════════════════════════════════════════
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO_ID="${ID:-unknown}"
        DISTRO_VER="${VERSION_ID:-unknown}"
    else
        DISTRO_ID="unknown"; DISTRO_VER="unknown"
    fi
}

# ══════════════════════════════════════════════════════════════
#   ESPERAR APT
# ══════════════════════════════════════════════════════════════
_wait_apt() {
    local waited=0
    while fuser "$APT_LOCK"  &>/dev/null 2>&1 || \
          fuser "$APT_LOCK2" &>/dev/null 2>&1 || \
          fuser "$APT_LOCK3" &>/dev/null 2>&1; do
        [[ "$waited" -eq 0 ]] && \
            _warn "apt ocupado, esperando (máx ${MAX_WAIT_APT}s)..."
        if [[ "$waited" -ge "$MAX_WAIT_APT" ]]; then
            _warn "Tiempo agotado. Forzando liberación de locks..."
            rm -f "$APT_LOCK" "$APT_LOCK2" "$APT_LOCK3" 2>/dev/null
            break
        fi
        sleep 3; waited=$(( waited + 3 ))
    done
}

# ══════════════════════════════════════════════════════════════
#   REPARAR SOURCES.LIST
# ══════════════════════════════════════════════════════════════
repair_sources() {
    phase_header "REPOSITORIOS" "Reparando sources.list"

    local content=""
    case "$DISTRO_ID" in
        ubuntu)
            case "$DISTRO_VER" in
                20.04) content="deb http://us.archive.ubuntu.com/ubuntu/ focal main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ focal-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ focal-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu focal-security main restricted universe multiverse" ;;
                22.04) content="deb http://us.archive.ubuntu.com/ubuntu/ jammy main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ jammy-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ jammy-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu jammy-security main restricted universe multiverse" ;;
                24.04) content="deb http://us.archive.ubuntu.com/ubuntu/ noble main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ noble-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ noble-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse" ;;
                26.04) content="deb http://us.archive.ubuntu.com/ubuntu/ plucky main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ plucky-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ plucky-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu plucky-security main restricted universe multiverse" ;;
            esac ;;
        debian)
            case "$DISTRO_VER" in
                10) content="deb http://deb.debian.org/debian buster main contrib non-free
deb https://deb.debian.org/debian-security/ buster-security main contrib non-free
deb http://deb.debian.org/debian buster-updates main contrib non-free" ;;
                11) content="deb https://deb.debian.org/debian bullseye main contrib non-free
deb https://deb.debian.org/debian-security/ bullseye-security main contrib non-free
deb https://deb.debian.org/debian bullseye-updates main contrib non-free" ;;
                12) content="deb https://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb https://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
deb https://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware" ;;
                13) content="deb https://deb.debian.org/debian trixie main contrib non-free non-free-firmware
deb https://security.debian.org/debian-security trixie-security main contrib non-free non-free-firmware
deb https://deb.debian.org/debian trixie-updates main contrib non-free non-free-firmware" ;;
            esac ;;
    esac

    if [[ -z "$content" ]]; then
        _warn "sources.list — distro no listada, omitiendo"
        return 0
    fi

    cp /etc/apt/sources.list /etc/apt/sources.list.bak 2>/dev/null || true
    if printf '%s\n' "$content" > /etc/apt/sources.list; then
        status_row 1 "sources.list" "reparado ($DISTRO_ID $DISTRO_VER)"
    else
        _error "No se pudo escribir /etc/apt/sources.list"
        return 1
    fi

    phase_ok "Repositorios listos"
}

# ══════════════════════════════════════════════════════════════
#   APT UPDATE + UPGRADE
# ══════════════════════════════════════════════════════════════
apt_update_upgrade() {
    phase_header "ACTUALIZACION" "apt update / upgrade"

    _wait_apt
    spinner_run "apt update" \
        apt-get update -qq "${APT_OPTS[@]}"

    _wait_apt
    spinner_run "apt upgrade" \
        apt-get upgrade -y -qq --no-install-recommends "${APT_OPTS[@]}"

    phase_ok "Sistema actualizado"
}

# ══════════════════════════════════════════════════════════════
#   FIREWALL
# ══════════════════════════════════════════════════════════════
disable_firewall() {
    phase_header "FIREWALL" "Deshabilitando reglas"

    for panel_svc in aaPanel bt BT hestia cyberpanel webmin plesk cpanel; do
        if systemctl is-active "$panel_svc" &>/dev/null 2>&1; then
            _warn "Panel $panel_svc detectado — firewall omitido"
            return 0
        fi
    done

    spinner_run "Deteniendo ufw" \
        bash -c 'systemctl stop ufw 2>/dev/null; systemctl disable ufw 2>/dev/null
                 ufw disable 2>/dev/null; true'

    spinner_run "Deteniendo firewalld" \
        bash -c 'systemctl stop firewalld 2>/dev/null
                 systemctl disable firewalld 2>/dev/null; true'

    spinner_run "Limpiando iptables" \
        bash -c 'command -v iptables &>/dev/null && {
            iptables -F; iptables -X; iptables -Z
            iptables -t nat -F; iptables -t nat -X
            iptables -t mangle -F; iptables -t mangle -X
            iptables -P INPUT ACCEPT; iptables -P FORWARD ACCEPT; iptables -P OUTPUT ACCEPT
        }
        command -v ip6tables &>/dev/null && {
            ip6tables -F; ip6tables -X; ip6tables -Z
            ip6tables -t mangle -F; ip6tables -t mangle -X
            ip6tables -P INPUT ACCEPT; ip6tables -P FORWARD ACCEPT; ip6tables -P OUTPUT ACCEPT
        }
        command -v nft &>/dev/null && nft flush ruleset 2>/dev/null; true'

    status_row 1 "Puertos" "abiertos"
    phase_ok "Firewall desactivado"
}

# ══════════════════════════════════════════════════════════════
#   DESCARGAR Y EJECUTAR BINARIO
# ══════════════════════════════════════════════════════════════
run_binary() {
    phase_header "DESCARGA E INSTALACION" "Descargando binario SN PLUS"

    local SUCCESS=0
    for i in 1 2 3; do
        spinner_run "Descargando (intento $i)" \
            bash -c "if command -v wget &>/dev/null; then
                wget -q --timeout=$WGET_TIMEOUT --tries=2 -O '$FILE' '$URL' && [ -s '$FILE' ]
            elif command -v curl &>/dev/null; then
                curl -fsSL --max-time $WGET_TIMEOUT --retry 2 -o '$FILE' '$URL' && [ -s '$FILE' ]
            else exit 1; fi"
        if [[ $? -eq 0 ]] && [[ -s "$FILE" ]]; then
            SUCCESS=1; break
        fi
        [[ $i -lt 3 ]] && sleep 2
    done

    if [[ "$SUCCESS" -ne 1 ]] || [[ ! -s "$FILE" ]]; then
        printf '\n'
        _error "No se pudo descargar el binario tras 3 intentos"
        printf '\n'
        exit 1
    fi

    chmod +x "$FILE"
    status_row 1 "Binario" "descargado y listo"
    printf '\n'

    "$FILE"
    local EXIT_CODE=$?
    if [[ "$EXIT_CODE" -ne 0 ]]; then
        printf '\n'
        _error "El instalador terminó con código $EXIT_CODE"
        printf '\n'
        exit "$EXIT_CODE"
    fi
}

# ══════════════════════════════════════════════════════════════
#   FLUJO PRINCIPAL
# ══════════════════════════════════════════════════════════════
detect_distro
check_root
check_lock

repair_sources
apt_update_upgrade
disable_firewall
run_binary
