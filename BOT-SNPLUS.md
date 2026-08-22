# 🤖 BOT SNPLUS — Actualización & Guía de Uso
### Por @SIN_NOMBRE22

---

## ✅ ¿Qué hay de nuevo?

Se ha reconstruido el Bot de Telegram de SNPLUS desde cero. Esta nueva versión corre de forma **nativa en el servidor**, sin depender de scripts externos ni sesiones secundarias. Arranca solo con el sistema, se recupera automáticamente si falla, y funciona en segundo plano sin que tengas que hacer nada.

Entre los ajustes principales:

- Los **nombres de usuario de Telegram** (`@usuario`) ahora se pueden tocar para ir directo al perfil — útil en las notificaciones de acceso.
- Los **datos de conexión** (usuario, contraseña, IP) se pueden copiar con un solo toque desde el chat.
- Las **notificaciones de intento de acceso** te muestran quién intentó entrar con un link directo a su perfil.
- El bot se **reinicia automáticamente** si el servidor se reinicia o si ocurre algún error.
- Mensajes largos se dividen solos, sin cortarse ni perderse información.

---

## 📲 Cómo crear tu bot en Telegram

Antes de instalar, necesitás un bot propio en Telegram. Solo se hace una vez:

1. Abrí Telegram y buscá **@BotFather**
2. Enviá el comando `/newbot`
3. Elegí un nombre para tu bot (ej: `Mi Panel VPS`)
4. Elegí un usuario para el bot — debe terminar en `bot` (ej: `mipanel_bot`)
5. BotFather te va a dar un **TOKEN** — copialo y guardalo, lo vas a necesitar

Para saber tu **ID de Telegram** (el tuyo, no el del bot):
- Buscá **@userinfobot** en Telegram
- Enviá cualquier mensaje y te responde con tu ID numérico

---

## ⚙️ Cómo instalar el bot en tu VPS

Una vez que tenés el TOKEN y tu ID, conectate al servidor como root inicia SNPLUS con

```
sn
```


Vas a ver el menú principal. Elegí la opción **BOT TELEGRAM** y luego **INICIAR BOT**. Si es la primera vez, te va a pedir:

- **Token del bot** → el que te dio BotFather
- **Tu ID de Telegram** → el número que obtuviste con @userinfobot

El bot queda instalado como servicio del sistema. La próxima vez que el servidor arranque, el bot sube solo.

---

## 🔄 Opciones del menú del bot

Desde el menú principal tenés acceso a:

| Opción | Para qué sirve |
|---|---|
| 🤖 BOT TELEGRAM | Iniciar, detener, reconfigurar o reiniciar el bot |
| ⚙️ INSTALAR DEPENDENCIAS | Instala todo lo necesario en el servidor |
| 🗑️ DESINSTALAR SNPLUS | Elimina el bot y todos sus archivos |
| 🔄 REINICIAR BOT | Reinicia el servicio rápidamente |

---

## 📋 Comandos disponibles en el chat del bot

Una vez que el bot está corriendo, desde Telegram podés usar:

- `/menu` — Abre el panel principal con todos los botones
- `/info` — Muestra información del servidor (IP, RAM, CPU, disco)
- `/ayuda` — Muestra esta lista de comandos

---

## 👤 Qué puede hacer cada tipo de usuario

**Administrador** — acceso total:
crear y eliminar usuarios, ver quién está online, cambiar contraseñas y fechas, crear cuentas de prueba, hacer backup, optimizar el servidor, ver velocidad y gestionar revendedores.

**Revendedor** — acceso parcial:
crear y eliminar sus propios usuarios, ver online, cambiar contraseña/límite/fecha, crear pruebas, gestionar sus subrevendedores.

**Subrevendedor** — acceso básico:
crear y eliminar sus usuarios, ver online, cambiar datos básicos y crear cuentas de prueba.

---

## ⚠️ Notificaciones de seguridad

Si alguien que no tiene permiso intenta usar el bot, el administrador recibe una alerta automática con el usuario de Telegram y su ID. Podés tocar el nombre directamente para ir a su perfil.

---

## 🛠️ ¿Problemas con el bot?

Si el bot no responde:


1. Entrá a **BOT TELEGRAM → REINICIAR BOT**
2. Si sigue sin funcionar, usá **RECONFIGURAR** para ingresar el token e ID nuevamente

---

*SNPLUS — @SIN_NOMBRE22*
