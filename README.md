## Cambios (noviembre 2026)

### UDP: Hysteria, ZivVPN y UDP-Custom juntos sin pisarse
Antes cada protocolo metía sus reglas NAT sueltas y ganaba la primera:
ZivVPN (5000-30000) se comía 20000-30000 del rango de Hysteria, la regla
"agarra todo" de UDP-Custom quedaba antes o después según el orden de
instalación, y las reglas se perdían al reiniciar sin iptables-persistent.

Ahora todo vive en una cadena propia `SN-UDP` (`Sistema/global/sn_udpnat.h`),
saltada desde la posición 1 de PREROUTING (solo las reglas de :53 de
SlowDNS van delante), con orden fijo:

| Prioridad | Tráfico UDP | Destino |
|---|---|---|
| 1 | :53 | SlowDNS / DNS (no se toca) |
| 2 | puertos reales de cada servicio | sin NAT |
| 3 | **20000-39999** | Hysteria |
| 4 | **6000-19999** | ZivVPN |
| 5 | todo lo demás | UDP-Custom (si está instalado) |

- Config: `/etc/sn-udpnat.conf` (la escriben los módulos solos).
- Script: `/usr/local/sbin/sn-udpnat` · servicio `sn-udpnat` + timer
  (al arrancar la VPS y cada 10 s; solo corrige si algo cambió).
- Purga reglas viejas de versiones anteriores y las que agregan los
  binarios con interfaz fija.
- Probado con tráfico UDP real: los 15 puertos de prueba llegaron cada uno
  a su servicio, con los 5 protocolos activos a la vez.
- VPS ya instaladas: al abrir `menu` se arma la config con los puertos
  reales y se aplica solo.

### Reseller desde el bot de licencias
- `Lic` recibe el reseller en cada heartbeat (5 min) y lo guarda firmado
  en `/etc/.sn/reseller` (no editable a mano). `Lic --reseller` lo imprime.
- Se muestra al final del banner de inicio y en el menú principal.
- Los actualizadores ahora también reemplazan `/usr/local/bin/Lic` (antes
  nunca se actualizaba en VPS ya instaladas).

### SN PLUS — otros arreglos
- Banner de inicio (`Sistema/global/sn_welcome.h`): sección **Reseller** al
  final. `menu` actualiza el banner en VPS viejas.
- Menú principal: línea "Reseller │ Licencia" y opción **98 RESELLER /
  LICENCIA** (solo lectura + revalidar).
- Las tarjetas de usuario (SSH, bot Telegram, bot WhatsApp) mostraban como
  rango de Hysteria el primer rango que encontraban en iptables (casi
  siempre el de ZivVPN) o un `40000-59999` inventado. Ahora muestran el real.
- Hysteria v2: el chequeo de puerto miraba TCP+UDP y el 443 de XRAY
  bloqueaba el 443/udp por defecto. Ahora solo UDP.
- Desinstalar Hysteria v1 mataba también el proceso de Hysteria v2.
- ZivVPN no acepta rangos que pisen 20000-39999; configs viejas se
  corrigen solas a 6000-19999.
- Contacto `@SINNOMBRE22` → `@SinNombreNET` en status y AdBlock.

**Importante:** recompila con `./bulid.sh` y sube los binarios (sobre todo
`Sistema/Lic`, `menu`, `install`, `Sistema/updater` y `Protocolos/*`).

---

<div align="center">

# 🛡️ SN PLUS

**VPS · VPN · Protocol Manager**

Panel de administración para servidores VPS: instala, configura y controla protocolos, usuarios y servicios desde un solo lugar.

<br>

![Estado](https://img.shields.io/badge/estado-activo-00d26a?style=flat-square)
![Versión](https://img.shields.io/badge/versión-estable-8b5cf6?style=flat-square)
![Ubuntu](https://img.shields.io/badge/Ubuntu-soportado-e95420?style=flat-square&logo=ubuntu&logoColor=white)
![Debian](https://img.shields.io/badge/Debian-soportado-a81d33?style=flat-square&logo=debian&logoColor=white)

<br>

[Protocolos](#-protocolos) · [Módulos](#-módulos) · [Bot de Telegram](#-bot-de-telegram) · [Instalación](#-instalación) · [Licencias](#-licencias) · [Soporte](#-soporte)

</div>

---

## ✨ Qué es SN PLUS

SN PLUS es un sistema para **instalar, configurar y administrar** servicios y protocolos en servidores VPS desde un entorno centralizado. Está pensado para simplificar la gestión del servidor, de los usuarios y de cada servicio, sin complicaciones.

---

## ⚡ Protocolos

| Protocolo | Descripción |
|:--|:--|
| 🔐 **SSH** | Acceso y túnel SSH |
| 📡 **UDP-Custom** | Conexiones UDP |
| 🌐 **SlowDNS** | Túnel mediante DNS |
| 🔴 **V2Ray / Xray** | Proxy y transporte avanzado |
| ⚡ **Hysteria** | Conexiones de alto rendimiento |
| 🔗 **WebSocket** | WebSocket / CDN |
| 🔒 **Stunnel** | SSL / TLS |
| 🪶 **Dropbear** | SSH ligero |

---

## 🧩 Módulos

| Módulo | Descripción |
|:--|:--|
| 🛡️ **ADBLOCK** | Bloqueo de publicidad y rastreadores |
| 📡 **BADVPN-UDPGW** | Soporte para conexiones UDP |
| ⚙️ **HAProxy MUX** | Multiplexación de conexiones |
| 🤖 **Bot de Telegram** | Administración de usuarios desde el celular |
| 🖥️ **Panel SN PLUS** | Gestión de protocolos y servicios |

---

## 🤖 Bot de Telegram

Administra tu VPS directamente desde el celular, en cualquier momento.

- ➕ Crear usuarios
- 🗑️ Eliminar usuarios
- 🔎 Consultar cuentas
- 🔐 Gestionar usuarios SSH

---

## 💻 Compatibilidad

| Sistema | Estado |
|:--|:--:|
| Ubuntu | ✅ |
| Debian | ✅ |

> [!TIP]
> Se recomienda usar una **instalación limpia** del sistema operativo.

---

## 📥 Instalación

Ejecuta el instalador oficial en tu VPS como `root`:

```bash
# Reemplaza por el comando oficial del instalador
rm -rf /root/install.sh && wget --no-cache -O /root/install.sh https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main/install.sh && chmod +x /root/install.sh && /root/install.sh
```

Al terminar, abre el panel y configura los servicios que necesites.

---

## 🛒 Licencias

Para adquirir una licencia de SN PLUS, escríbeme por mensaje privado:

<div align="center">

[![WhatsApp](https://img.shields.io/badge/WhatsApp-+52%201%20562%20988%205039-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://wa.me/5215629885039)
[![Telegram](https://img.shields.io/badge/Telegram-@SIN__NOMBRE22-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/SinNombreNET)

</div>

---

## 🌐 Comunidad

Novedades, actualizaciones e información sobre SN PLUS:

<div align="center">

[![Grupo de WhatsApp](https://img.shields.io/badge/Grupo-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://chat.whatsapp.com/EcMClegA2DVBZRiudPqYqP)
[![Canal de Telegram](https://img.shields.io/badge/Canal-Telegram-0088cc?style=flat-square&logo=telegram&logoColor=white)](https://t.me/SN_PLUS)

</div>

---

## 🆘 Soporte

¿Ayuda con la instalación, la configuración o el funcionamiento de SN PLUS?

<div align="center">

[![Soporte directo](https://img.shields.io/badge/Soporte%20directo-@SIN__NOMBRE22-8b5cf6?style=flat-square&logo=telegram&logoColor=white)](https://t.me/SinNombreNET)

</div>

---

<div align="center">

**🛡️ SN PLUS — Simple · Directo · Potente**

<sub>© 2026 · SINNOMBRE22</sub>

</div>
