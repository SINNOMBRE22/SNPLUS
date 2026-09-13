# ⚠️ NOTAS GENERALES — SN PLUS

---

## 🖥️ Sistemas Operativos Compatibles

| Distribución | Versiones Soportadas | Arquitectura |
| :--- | :--- | :--- |
| **Ubuntu** | 22.04 · 24.04 · 26.04 | `amd64` (x86\_64) |
| **Debian** | 11 (Bullseye) · 12 (Bookworm) | `amd64` (x86\_64) |

> ⚠️ **No se garantiza** el funcionamiento en otras distribuciones o arquitecturas (ARM, 32-bit).
> El instalador detecta automáticamente tu sistema y aplica los parches necesarios.

---

## 💡 Recomendación Importante

**Usa un VPS "virgen"** — recién formateado, sin paneles ni scripts previos instalados.
Esto previene conflictos de puertos, dependencias rotas y configuraciones que interfieran con SN PLUS.

---

## 📦 Requisitos Mínimos del VPS

| Recurso | Mínimo | Recomendado |
| :--- | :--- | :--- |
| **RAM** | 1 GB | 2 GB (para múltiples protocolos) |
| **Disco** | 10 GB libres | 20 GB |
| **Acceso** | Root | Root |
| **Red** | Conexión estable | Baja latencia |

- Los puertos que uses (SSH, SOCKS, UDP, etc.) no deben estar bloqueados por un firewall externo.
- Se requiere conexión a Internet durante la instalación para descargar dependencias.

---

## 🚀 Instalación

Ejecuta el siguiente comando como **root**:

```bash
bash <(curl -sL https://raw.githubusercontent.com/SINNOMBRE22/SNPLUS/main/install.sh)
```

El script descargará los binarios, configurará dependencias y mostrará el menú principal.

> [!TIP]
> Si el comando falla, verifica que `curl` esté instalado:
> ```bash
> apt update && apt install curl -y
> ```

---

## ⚙️ Configuración Inicial

Después de la instalación, SN PLUS te guiará paso a paso para:

1. Configurar el dominio o IP del VPS *(opcional)*.
2. Seleccionar los protocolos a activar — SSH, SlowDNS, V2Ray, Hysteria, etc.
3. Crear usuarios SSH con límites de conexión, velocidad y consumo.
4. Levantar puertos SOCKS con o sin X-Pass y path personalizado.

> [!IMPORTANT]
> Lee cada menú antes de continuar. Las opciones están numeradas y son autodescriptivas.
> Si te equivocas, puedes volver atrás o usar la opción de **reparación** en cualquier momento.

---

## 🔑 Licencias y Activación

SN PLUS requiere una licencia válida para funcionar. Cada licencia está vinculada a un VPS.

### Canales Oficiales de Venta

| Canal | Enlace |
| :--- | :--- |
| 📱 **Telegram** | [@SIN\_NOMBRE22](https://t.me/SIN_NOMBRE22) |
| 💬 **WhatsApp** | [+52 1 56 2988 5039](https://wa.me/5215629885039) |

### Métodos de Pago Aceptados

| Método | Detalle |
| :--- | :--- |
| 🏦 **Transferencia Bancaria** | Cuentas en México — SPEI / CLABE |
| ₿ **Criptomonedas** | USDT (TRC-20 / ERC-20) · Bitcoin (BTC) |
| 🅿️ **PayPal** | Pago directo — solicita el correo al agente |
| 🌐 **AstroPay** | Disponible para LATAM — coordinar con soporte |
| 🏪 **OXXO Pay** | Depósito en efectivo con ayuda del agente |

> [!WARNING]
> **No compartas tu licencia.** Cada licencia es personal e intransferible.
> Si cambias de VPS, contacta a soporte para reasignación *(puede tener costo adicional)*.

---

## 🛠️ Solución de Problemas Comunes

| Problema | Solución |
| :--- | :--- |
| **Error de licencia** | Verifica que hayas introducido la clave correctamente. Si persiste, contacta soporte. |
| **Puerto en uso** | Ejecuta `lsof -i :<puerto>` para identificar el proceso y detenerlo. |
| **Python 2 no encontrado** | Usa la opción de reparación en el menú SOCKS; instalará Python 2 automáticamente. |
| **Limitador no funciona** | Ejecuta `apt install iproute2 iptables -y` y reinicia el módulo. |
| **No se crean usuarios** | El nombre de usuario solo admite letras, números y guiones. Evita caracteres especiales. |

Si nada funciona, escríbenos directamente al [grupo de soporte en Telegram](https://t.me/SIN_NOMBRE22).

---

## 📚 Documentación Adicional

- 🔗 [Guía SOCKS + SSH flexible](https://t.me/SN_PLUS) — Configura túneles con path y X-Pass.
- 🤖 [Bot de Telegram](.BOT-SNPLUS.md/) — Administra tu VPS desde el celular.

---

## 💬 Canal de Novedades

Únete al canal oficial para recibir actualizaciones, módulos nuevos y parches de seguridad:

> 📢 **Telegram:** [@SN\_PLUS](https://t.me/SN_PLUS)

---

<div align="center">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SN PLUS VPN SERVICES**

<sub>© 2026 · SINNOMBRE22 · Todos los derechos reservados</sub>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

</div>
