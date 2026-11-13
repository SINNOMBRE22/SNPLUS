# Novedades de SN PLUS

Para actualizar: escribe `menu` y elige **101 · Actualizar script**.
Dudas y avisos en el [grupo de Telegram](https://t.me/SN_PLUS).

---

## Noviembre 2026 · Conexiones con IP y estadísticas por usuario

- **Usuarios SSH → Conectados ahora**: cada conexión abierta con la **IP real del cliente**, por dónde entró (SSH, Dropbear, Stunnel, WebSocket…) y cuánto lleva. Cada una se puede cortar sola, sin tirar las demás del usuario.
  - Si el usuario entró por Stunnel o WebSocket se muestra la IP de su celular, no la 127.0.0.1 del proxy.
- **Estadísticas de cada usuario** (botón de gráfica o clic en el nombre): consumo de hoy, 7 días, 30 días y del mes; gráfica por día (30 días) y por hora (24 h); última conexión y máximo de conexiones del día.
- **Arreglo del consumo**: se contaba de más (2 o 3 veces lo real). Ahora es el tráfico real de la cuenta (subida + bajada). Al actualizar verás números más bajos: esos son los correctos.
- Todos los usuarios llevan contador de consumo, aunque no tengan límite.
- Al eliminar un usuario se borran también sus reglas de velocidad y consumo (antes quedaban en la VPS).
- **Límite de consumo con el limitador activo**: quien pasa su límite se bloquea y aparece como «Consumo agotado». Ya no se desbloquea solo: se desbloquea cuando le subes (o quitas) el límite de consumo al editarlo.
- Arreglo: editar un usuario bloqueado (cambiarle clave, días, etc.) lo desbloqueaba sin querer. Ahora sigue bloqueado.

## Noviembre 2026 · Panel web

Administra tu VPS desde el navegador: `https://IP-DE-TU-VPS:4747`.

- Se activa en **menu → Herramientas → 17 · Panel web** (puerto, usuario y contraseña propios; HTTPS con certificado propio).
- **Dashboard**: CPU, RAM, disco, tráfico de red, servicios activos y resumen de usuarios.
- **Usuarios SSH**: crear, editar, renovar, bloquear, desconectar y eliminar, con buscador y filtros (en línea, por vencer, vencidos, bloqueados). Al crear se genera la tarjeta con los datos listos para copiar.
- **Entra por IP o por dominio** (Panel web → 4 · Acceso por dominio):
  - **Cloudflare con nube naranja**: sin aviso de "no seguro" y carga aunque estés conectado por SSH/SSL a esa misma VPS.
  - **Dominio directo**: certificado real de Let's Encrypt que se renueva solo.
- Si estás conectado por SSH/SSL a la misma VPS, el menú del panel te da también la dirección interna para entrar.
- **V2Ray / Xray MOD**: crear (con UUID propio si quieres), renovar, bloquear y eliminar; link y **código QR** para escanear desde la app; consumo por usuario en Xray si tiene las estadísticas activas.
- **Arreglo V2Ray**: bloquear ahora sí corta al usuario (antes solo lo marcaba y seguía conectando). Los que ya estaban bloqueados se corrigen solos al abrir el menú o el panel.
- **Protocolos**: estado, puertos e iniciar / detener / reiniciar de cada uno. «Administrar» abre el menú de ese protocolo en una **consola en vivo** para instalar, desinstalar y cambiar puertos.
- **Terminal**: el menú SN PLUS completo y bash de root desde el navegador (sirve aunque estés conectado por SSH/SSL a esa misma VPS).
- **Respaldos**: crear (SSH, V2Ray, Xray o todo junto), restaurar cualquier versión, descargar, subir uno de otra VPS y eliminar. Son los mismos archivos de `/root` que usa el menú.
- Solo entra el dueño de la VPS. 5 intentos fallidos bloquean la IP 15 minutos.
- Herramientas se reordenó en dos columnas y se quitó CloudFront.
- Protocolos: se quitaron NGINX WS Pro, HAProxy MUX y Multiplexor (ya no se usan) y se reordenó el menú; ahora son 21 (V2Ray es la 10 y Xray MOD la 11).

## Noviembre 2026 · Respaldo de usuarios

Pasa tus usuarios a otra VPS sin volver a crearlos.

- **Usuarios SSH → 13**, **V2Ray → 6**, **Xray MOD → 6**: `Respaldar` / `Restaurar`.
- **Herramientas → 16**: los tres juntos.
- Se guardan en `/root` (`backup_ssh_v1.0.tar.gz`, `backup_v2ray_…`, `backup_xray_…`); al restaurar se usa siempre la versión más alta.
- SSH conserva clave, fecha, límite de conexiones, velocidad, consumo, horarios y bloqueos. V2Ray y Xray conservan el **mismo UUID** y los bloqueados siguen bloqueados.
- Los usuarios que ya existen no se duplican.
- En una VPS nueva sin usuarios, el panel avisa si encuentra un respaldo en `/root`.

## Noviembre 2026 · v6.0.0

### UDP: Hysteria, ZivVPN y UDP-Custom juntos sin pisarse
Antes cada protocolo ponía sus propias reglas y el que se instalaba primero se quedaba con los puertos de los demás; además, las reglas se perdían al reiniciar la VPS.

Ahora SN PLUS reparte el tráfico UDP con un orden fijo:

| Prioridad | Tráfico UDP | Va a |
|:--:|:--|:--|
| 1 | puerto 53 | SlowDNS / DNS |
| 2 | puertos propios de cada servicio | directo, sin redirección |
| 3 | **20000-39999** | Hysteria |
| 4 | **6000-19999** | ZivVPN |
| 5 | todo lo demás | UDP-Custom (si está instalado) |

- Se aplica sola al arrancar la VPS y se revisa cada 10 segundos.
- Limpia las reglas viejas que dejaban versiones anteriores.
- Probado con los 5 protocolos activos a la vez: cada puerto llegó a su servicio.
- En VPS que ya tenían SN PLUS se configura sola al abrir `menu`.

### Revendedor y licencia
- El banner de inicio y el menú principal muestran tu **revendedor** y el estado de la licencia.
- Nueva opción **98 · Reseller / Licencia** para verla y revalidarla.
- El actualizador ahora también actualiza el validador de licencia.

### Arreglos
- Las tarjetas de usuario (SSH, bot de Telegram y bot de WhatsApp) ahora muestran el rango **real** de Hysteria.
- Hysteria v2 ya no choca con el 443 de Xray: solo revisa el puerto UDP.
- Desinstalar Hysteria v1 ya no detiene Hysteria v2.
- ZivVPN no acepta rangos que pisen los de Hysteria; las configuraciones viejas se corrigen solas a 6000-19999.
- Contacto actualizado a **@SinNombreNET**.
