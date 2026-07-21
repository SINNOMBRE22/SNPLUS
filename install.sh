#!/bin/bash

set -e

R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
N='\033[0m'
D='\033[2m'

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

wait_apt() {
    local waited=0
    while fuser "$APT_LOCK" &>/dev/null 2>&1 || \
          fuser "$APT_LOCK2" &>/dev/null 2>&1 || \
          fuser "$APT_LOCK3" &>/dev/null 2>&1; do
        if [[ "$waited" -ge "$MAX_WAIT_APT" ]]; then
            rm -f "$APT_LOCK" "$APT_LOCK2" "$APT_LOCK3" 2>/dev/null
            break
        fi
        sleep 3; waited=$(( waited + 3 ))
    done
}

spinner() {
    local msg="$1"; shift
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local idx=0
    printf "\033[?25l"
    "$@" >/dev/null 2>&1 &
    local pid=$!
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  %s %s" "$msg" "${frames[$idx]}"
        idx=$(( (idx + 1) % 10 ))
        sleep 0.1
    done
    wait "$pid"
    local rc=$?
    if [[ $rc -eq 0 ]]; then
        printf "\r  %s [${G}✔${N}]\n" "$msg"
    else
        printf "\r  %s [${R}✗${N}]\n" "$msg"
    fi
    printf "\033[?25h"
    return $rc
}

if [[ "$(id -u)" -ne 0 ]]; then
    echo -e "${R}Acceso denegado. Ejecute con sudo.${N}"
    exit 1
fi

if [[ -f "$LOCK_FILE" ]]; then
    pid=$(cat "$LOCK_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo "SNPLUS ya está en ejecución (PID $pid)."
        exit 1
    fi
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_VER="${VERSION_ID:-unknown}"
fi

echo -e "${D}Distro detectada: $DISTRO_ID $DISTRO_VER${N}"

need_repair=0
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    case "$ID" in
        ubuntu)
            case "$VERSION_ID" in
                20.04|22.04|24.04|26.04) need_repair=0 ;;
                *) need_repair=1 ;;
            esac ;;
        debian)
            case "$VERSION_ID" in
                10|11|12|13) need_repair=0 ;;
                *) need_repair=1 ;;
            esac ;;
        *) need_repair=0 ;;
    esac
fi

if [[ $need_repair -eq 1 ]]; then
    echo "Reparando sources.list..."
    cp /etc/apt/sources.list /etc/apt/sources.list.bak 2>/dev/null
    case "$DISTRO_ID" in
        ubuntu)
            case "$DISTRO_VER" in
                20.04)
                    cat > /etc/apt/sources.list <<EOF
deb http://us.archive.ubuntu.com/ubuntu/ focal main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ focal-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ focal-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu focal-security main restricted universe multiverse
EOF
                    ;;
                22.04)
                    cat > /etc/apt/sources.list <<EOF
deb http://us.archive.ubuntu.com/ubuntu/ jammy main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ jammy-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ jammy-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu jammy-security main restricted universe multiverse
EOF
                    ;;
                24.04)
                    cat > /etc/apt/sources.list <<EOF
deb http://us.archive.ubuntu.com/ubuntu/ noble main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ noble-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ noble-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse
EOF
                    ;;
                26.04)
                    cat > /etc/apt/sources.list <<EOF
deb http://us.archive.ubuntu.com/ubuntu/ plucky main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ plucky-updates main restricted universe multiverse
deb http://us.archive.ubuntu.com/ubuntu/ plucky-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu plucky-security main restricted universe multiverse
EOF
                    ;;
            esac
            ;;
        debian)
            case "$DISTRO_VER" in
                10)
                    cat > /etc/apt/sources.list <<EOF
deb http://deb.debian.org/debian buster main contrib non-free
deb https://deb.debian.org/debian-security/ buster-security main contrib non-free
deb http://deb.debian.org/debian buster-updates main contrib non-free
EOF
                    ;;
                11)
                    cat > /etc/apt/sources.list <<EOF
deb https://deb.debian.org/debian bullseye main contrib non-free
deb https://deb.debian.org/debian-security/ bullseye-security main contrib non-free
deb https://deb.debian.org/debian bullseye-updates main contrib non-free
EOF
                    ;;
                12)
                    cat > /etc/apt/sources.list <<EOF
deb https://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb https://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
deb https://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware
EOF
                    ;;
                13)
                    cat > /etc/apt/sources.list <<EOF
deb https://deb.debian.org/debian trixie main contrib non-free non-free-firmware
deb https://security.debian.org/debian-security trixie-security main contrib non-free non-free-firmware
deb https://deb.debian.org/debian trixie-updates main contrib non-free non-free-firmware
EOF
                    ;;
            esac
            ;;
    esac
    echo "  sources.list reparado."
fi

wait_apt
spinner "Actualizando repositorios" apt update -y -q "${APT_OPTS[@]}"
wait_apt
spinner "Actualizando paquetes" apt upgrade -y -q --no-install-recommends "${APT_OPTS[@]}"

for svc in ufw firewalld; do
    systemctl stop "$svc" &>/dev/null || true
    systemctl disable "$svc" &>/dev/null || true
done
iptables -F 2>/dev/null || true
iptables -t nat -F 2>/dev/null || true
ip6tables -F 2>/dev/null || true
nft flush ruleset 2>/dev/null || true
echo "Firewall desactivado."

LIB_DIR="/etc/SNPLUS/Sistema/global"
mkdir -p "$LIB_DIR"
if [[ ! -f "$LIB_DIR/libsn_global.so" ]]; then
    spinner "Descargando librería global" \
        wget -q -O "$LIB_DIR/libsn_global.so" \
        "https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main/Sistema/global/libsn_global.so"
    chmod 755 "$LIB_DIR/libsn_global.so"
fi
export LD_LIBRARY_PATH="$LIB_DIR:$LD_LIBRARY_PATH"

SUCCESS=0
for i in 1 2 3; do
    spinner "Descargando binario (intento $i)" \
        bash -c "if command -v wget &>/dev/null; then
            wget -q --timeout=$WGET_TIMEOUT --tries=2 -O '$FILE' '$URL' && [ -s '$FILE' ]
        elif command -v curl &>/dev/null; then
            curl -fsSL --max-time $WGET_TIMEOUT --retry 2 -o '$FILE' '$URL' && [ -s '$FILE' ]
        else exit 1; fi"
    if [[ $? -eq 0 ]] && [[ -s "$FILE" ]]; then
        SUCCESS=1
        break
    fi
    sleep 2
done

if [[ $SUCCESS -ne 1 ]] || [[ ! -s "$FILE" ]]; then
    echo -e "${R}Error: No se pudo descargar el binario.${N}"
    exit 1
fi

chmod +x "$FILE"
echo "Binario descargado y listo."

"$FILE"
exit_code=$?
if [[ $exit_code -ne 0 ]]; then
    echo -e "${R}El instalador terminó con código $exit_code${N}"
    exit $exit_code
fi

echo -e "${G}Instalación completada.${N}"
