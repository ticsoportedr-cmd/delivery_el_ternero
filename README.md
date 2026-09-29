# EL TERNERO — Sistema de Delivery y Salón

Sistema de pedidos a domicilio con seguimiento GPS en vivo y gestión de salón (15 mesas): vistas de cliente, mozo, repartidor, cocina y administración.

> **Proyecto independiente de Calcol.** Tiene su propia carpeta, su propio repositorio, su propio proyecto de Firebase y sus propias claves. Nada de este proyecto usa ni modifica archivos, bases de datos o claves de Calcol.

---

## Estado actual — Fase 1 (desarrollo local + GitHub)

| Ítem | Estado |
|---|---|
| Código fuera de AI Studio, en GitHub privado | ✅ Esta fase |
| Claves fuera del código (archivo `.env`) | ✅ Hecho |
| Datos en vivo fuera del código (`data/`, excluida de Git) | ✅ Hecho |
| Apto para producción | ❌ **No todavía** — ver "Bloqueantes para producción" |

---

## 1. Requisitos (una sola vez)

1. **Node.js 22 LTS** — https://nodejs.org (si Calcol ya funciona en la PC, Node ya está instalado; no reinstalar).
2. **Git** — https://git-scm.com/download/win
3. **Cuenta de GitHub** `ticsoportedr-cmd`.

Verificar en PowerShell:

```powershell
node --version   # debe mostrar v20 o superior
git --version
```

## 2. Carpeta del proyecto (separada de Calcol)

```powershell
mkdir "$HOME\Documents\Proyectos\delivery_el_ternero"
```

Descomprimir el proyecto en esa carpeta. **No** ponerlo dentro de la carpeta de Calcol.

## 3. Configurar claves

1. Copiar `.env.example` y renombrar la copia a `.env`.
2. Completar:
   - `PORT=3200` (para no chocar con Calcol si usa el 3000).
   - `VITE_GOOGLE_MAPS_API_KEY=` la clave de Google Maps **del proyecto de EL TERNERO**.
   - `GEMINI_API_KEY=` (opcional).

## 4. Instalar y ejecutar

**Forma rápida:** doble clic en `instalar_y_ejecutar.bat` (crea `.env` si falta, instala y arranca). Registros en `instalacion.log` y `servidor.log`.

**Forma manual:**

```powershell
cd "$HOME\Documents\Proyectos\delivery_el_ternero"
npm install
npm run dev
```

Abrir **http://localhost:3200**.

- El primer arranque crea `data\data_store.json` con los datos de ejemplo (`data_store.seed.json`).
- Para volver a los datos de ejemplo: detener el servidor (Ctrl+C), borrar la carpeta `data` y arrancar de nuevo.

## 4.1 Probar desde el celular (con GPS)

1. Tener abierto `instalar_y_ejecutar.bat` (servidor funcionando).
2. Doble clic en `probar_en_celular.bat`. La primera vez descarga la herramienta `cloudflared` (gratis, de Cloudflare) en la carpeta `herramientas/`.
3. En la ventana aparece una dirección `https://xxxx.trycloudflare.com`. Abrirla en el celular (WiFi o datos).
4. Para que se vea el mapa: en Google Cloud Console, agregar `*.trycloudflare.com/*` y `*.loca.lt/*` a los sitios permitidos de la clave de Maps (solo durante las pruebas).
5. Al terminar, **cerrar la ventana**. El enlace deja de funcionar y cambia en cada uso.

> El enlace es público mientras la ventana está abierta: usar solo datos de prueba.

**Alternativa sin GPS (misma red WiFi):** en el celular abrir `http://IP-DE-LA-PC:3200` (la IP se ve con `ipconfig`, línea "Dirección IPv4"). Sirve para ver el diseño, pero el navegador del celular bloquea la ubicación porque no es `https`.

### Si la pantalla sale en blanco

| Lo que se ve | Significado | Qué hacer |
|---|---|---|
| Pantalla de carga que no avanza | El servidor responde, falla la pantalla | F12 → pestaña *Console* → copiar el error en rojo |
| Blanco total | El servidor no arrancó | Mirar la ventana de PowerShell: el error aparece ahí |
| Mapa gris | Sin internet o bloqueo del proveedor de mapas | Revisar conexión; el mapa oficial de Google llega en la Fase 2 |

## 5. Subir a GitHub (primera vez)

1. En https://github.com/new crear el repositorio **`delivery_el_ternero`**, **Private**, sin README.
2. En PowerShell, dentro de la carpeta del proyecto:

```powershell
git init
git add .
git status
```

3. **Control antes de subir** — en la lista de `git status` **NO** deben aparecer:
   - `.env`
   - la carpeta `data/`
   - `node_modules/`

   Si aparece alguno, detenerse y revisar `.gitignore`.

4. Subir:

```powershell
git commit -m "Fase 1: proyecto EL TERNERO fuera de AI Studio"
git branch -M main
git remote add origin https://github.com/ticsoportedr-cmd/delivery_el_ternero.git
git push -u origin main
```

## 6. Trabajo diario

```powershell
git pull                      # traer cambios
npm run dev                   # trabajar
git add .
git commit -m "Descripción corta del cambio"
git push
```

## 7. Firebase — regla de oro (para no tocar Calcol)

- El archivo `.firebaserc` fija el proyecto de Firebase de **esta** carpeta. Reemplazar `REEMPLAZAR-CON-ID-DE-EL-TERNERO-PRUEBAS` por el ID real del proyecto **el-ternero-pruebas** (y más adelante agregar el de producción) (cuenta ticsoporte.dr@gmail.com).
- **Antes de cualquier `firebase deploy`**, ejecutar `firebase use` y confirmar que muestra el proyecto de EL TERNERO.
- Nunca ejecutar `firebase deploy` desde la carpeta de Calcol pensando en EL TERNERO, ni al revés.

---

## Bloqueantes para producción (se resuelven en la Fase 2)

1. **Claves de personal escritas en la pantalla** (`admin/admin123`, `cocina/cocina123`, PIN `1234`). → Firebase Auth.
2. **Contraseñas de clientes y repartidores sin cifrar**, y enviadas a todos los navegadores conectados. → Firebase Auth.
3. **API sin control de acceso**: cualquiera puede borrar pedidos o productos. → Reglas de seguridad de Firestore.
4. **Base de datos en un archivo JSON**: se pierde con dos escrituras simultáneas y no sirve en la nube. → Firestore.
5. **Pago con Google Pay simulado** (marca pagado sin cobrar). → **Ya oculto** para clientes; integrar pasarela real (p. ej. Bancard) antes de reactivarlo (`PAGO_GPAY_HABILITADO` en `CustomerTrackingView.tsx`).
6. **Mapa con imágenes de Google cargadas sin licencia** (Leaflet + servidores de Google). → Reemplazar por Google Maps oficial.
7. **Rutas y distancias con servidor de demostración OSRM** (sin garantía ni uso comercial). → Google Routes (costo de envío por distancia de calle).

## Hoja de ruta

| Fase | Contenido |
|---|---|
| 1 | GitHub + ejecución local limpia (**actual**) — ambiente **el-ternero-pruebas** |
| 2 | Firestore + Firebase Auth + reglas; mapa y rutas oficiales de Google; publicación en Firebase Hosting (pruebas → producción) |
| 3 | App Repartidor en Flutter (GPS en segundo plano, notificaciones) |
| 4 | App Cliente en Flutter; pedido por QR de mesa sigue en web |
| 5 | Integración con el POS del local |

## Estructura

```
server.ts                 Servidor (API + Socket.IO + Gemini)
src/App.tsx               Selector de vistas y conexión en vivo
src/components/           Vistas: Cliente, Mozo (salón), Repartidor, Cocina, Admin, Mapa
public/                   Íconos, manifest y service worker
data_store.seed.json      Datos de ejemplo para el primer arranque
data/                     Datos en vivo (NO se sube a GitHub)
```
