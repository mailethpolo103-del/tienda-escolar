# 🎒 Tienda Escolar Inteligente

Aplicación web progresiva (PWA) para que estudiantes, profesores y personal de una institución educativa realicen pedidos desde sus dispositivos sin hacer filas, mientras el administrador gestiona los pedidos en tiempo real.

---

## ✅ Características implementadas

### 🏪 Tienda principal (`index.html`)
- **Catálogo** organizado en 6 categorías (los productos se administran desde el panel)
- Tarjetas de producto con emoji, color, precio, rating y estado de stock
- **Carrito de compras** con cantidades, subtotal, descuentos y total
- **Buscador en tiempo real** con filtros por categoría y ordenamiento
- **Favoritos** guardados en localStorage
- **Cupones de descuento** (porcentaje y valor fijo)
- **Sistema de checkout** en 2 pasos con selección de método de pago
- **Código QR de pago** generado dinámicamente (Nequi, Daviplata, Bancolombia, Efectivo)
- **Carga y validación de comprobante** de pago
- **Tracking de pedido** con 4 estados: 🟡 Recibido → 🟠 Preparando → 🟢 Listo → ✅ Entregado
- **Notificaciones** (toast, modal, sonido y push API) cuando el pedido está listo
- **Polling automático** para actualizar el estado del pedido
- **Historial de pedidos** del usuario
- **Modo claro/oscuro** con persistencia
- **Diseño 100% responsivo** (móvil, tablet, desktop)
- **Navegación inferior** para móvil
- **Horario de atención** con indicador de tienda abierta/cerrada
- **Sistema de login/registro** (simulado)

### ⚙️ Panel administrador (`admin.html`)
- **Dashboard** con estadísticas en tiempo real
- **Gestión de pedidos** con botones de cambio de estado
- **Notificación automática** cuando el estado cambia a "Listo para recoger"
- **Validación de pagos** manualmente
- **Gestión de productos** (crear, editar, eliminar, activar/desactivar)
- **Toggle de disponibilidad** con switch
- **Control de inventario** con alertas de stock bajo
- **Estadísticas y gráficos** (Chart.js):
  - Ventas por día (7 días)
  - Top productos más vendidos
  - Pedidos por estado (doughnut)
  - Ventas por categoría (pie)
- **Gestión de cupones** de descuento
- **Auto-actualización** cada 30 segundos
- **Modo claro/oscuro**

---

## 💾 ¿Dónde se guardan los datos?

La versión original usaba la *Tables API* de Genspark (`fetch('tables/...')`), que **solo existe dentro de Genspark**. Por eso fuera de Genspark no aparecía ningún producto.

Ahora todo pasa por `js/db.js`, que funciona en cualquier lugar y tiene dos modos:

| Modo | Cuándo se usa | Dónde quedan los datos |
|------|---------------|------------------------|
| 💾 Local | `FIREBASE_CONFIG = null` (por defecto) | En el navegador (localStorage). Solo sirve para probar: cada navegador tiene sus propios datos. |
| ☁️ Firebase | Pegas tu configuración en `FIREBASE_CONFIG` | En Cloud Firestore (Google). Admin, clientes y pantalla de turnos ven lo mismo desde cualquier dispositivo. |

No hay productos escritos en el código: se crean desde **admin.html → Productos → Agregar producto**, o se cargan con **Importar**.

### Conectar Firebase (gratis)
1. Entra a https://console.firebase.google.com y crea un proyecto.
2. En el menú: **Compilación → Firestore Database → Crear base de datos** (elige una ubicación cercana, p. ej. `southamerica-east1`).
3. En **Reglas**, para empezar a probar, usa:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if true; }
     }
   }
   ```
   ⚠️ Esto deja la base abierta; sirve para clase/pruebas. Antes de usarla de verdad, agrega autenticación.
4. **Configuración del proyecto (⚙️) → Tus apps → Web (`</>`)**, registra la app y copia el objeto `firebaseConfig`.
5. Pégalo en `js/db.js` en lugar de `const FIREBASE_CONFIG = null;`.
6. Abre `admin.html`: debe decir “☁️ Datos guardados en Firebase”.

### Cargar los datos iniciales (30 productos y 3 cupones)
Los datos NO están escritos en el código. Vienen en el archivo `datos-tienda.json`:
1. Abre `admin.html → Productos → Importar`.
2. Selecciona `datos-tienda.json`.
3. Listo: quedan guardados en la base de datos (local o Firebase). Solo se hace una vez.

### Pasar los productos que tenías en Genspark
1. Abre tu proyecto en Genspark y entra a la URL `.../tables/products?limit=100` (misma dirección de tu página, cambiando `index.html` por eso).
2. Guarda ese texto como `productos.json`.
3. En `admin.html → Productos → Importar`, selecciona el archivo.

El botón **Exportar** descarga un respaldo con productos, pedidos y cupones, que también se puede volver a importar.

---

## 📁 Estructura del proyecto

```
/
├── index.html          ← Tienda principal (clientes)
├── admin.html          ← Panel administrador
├── css/
│   └── style.css       ← Estilos globales con variables CSS y modo oscuro
├── turnos.html         ← Pantalla de turnos
├── js/
│   ├── db.js           ← Capa de datos (Firebase o localStorage) ← configurar aquí
│   └── app.js          ← Lógica principal (carrito, pedidos, notificaciones)
└── README.md
```

---

## 🔗 URLs de acceso

| Ruta | Descripción |
|------|-------------|
| `/index.html` | Tienda principal (clientes) |
| `/admin.html` | Panel de administración |

---

## 🗂️ Modelos de datos

### `products`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | text | ID único del producto |
| name | text | Nombre |
| description | text | Descripción corta |
| price | number | Precio en COP |
| category | text | Categoría principal |
| subcategory | text | Subcategoría |
| image_emoji | text | Emoji representativo |
| image_color | text | Color de fondo (hex) |
| stock | number | Unidades disponibles |
| available | bool | Si está activo |
| featured | bool | Si es destacado |
| rating | number | Calificación (1-5) |
| sales_count | number | Unidades vendidas |

### `orders`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | text | ID único |
| order_number | text | Número legible (#XXXX) |
| user_id | text | ID del usuario |
| user_name | text | Nombre del cliente |
| user_email | text | Correo del cliente |
| items | rich_text | JSON con los productos |
| total | number | Total del pedido |
| status | text | received/preparing/ready/delivered |
| payment_method | text | Método de pago |
| payment_proof | text | URL comprobante |
| payment_validated | bool | Pago confirmado |
| estimated_time | number | Minutos estimados |
| notes | text | Notas del cliente |

### `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | text | ID único |
| name | text | Nombre completo |
| email | text | Correo |
| student_id | text | ID estudiantil |
| role | text | student/teacher/staff/admin |
| favorites | rich_text | JSON con IDs favoritos |
| total_orders | number | Pedidos históricos |

### `coupons`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | text | ID único |
| code | text | Código del cupón |
| discount_type | text | percentage / fixed |
| discount_value | number | Valor del descuento |
| min_purchase | number | Compra mínima requerida |
| active | bool | Si está activo |
| uses_left | number | Usos restantes |

---

## 🎫 Cupones de ejemplo disponibles

| Código | Descuento | Mínimo |
|--------|-----------|--------|
| `BIENVENIDO10` | 10% | $10.000 |
| `ESCUELA2024` | $2.000 | $15.000 |
| `DESCUENTO15` | 15% | $20.000 |

---

## 📦 Categorías y productos incluidos

- 🥤 **Bebidas**: Gaseosas, Jugos, Agua, Energizantes, Té, Café (7 productos)
- 🍦 **Helados**: Paletas, Conos, Vasos, Premium (4 productos)
- 🍟 **Snacks**: Papas, Chitos, Galletas, Chocolates, Gomitas (5 productos)
- 🥐 **Panadería**: Empanadas, Pasteles, Panes, Croissants, Donas (5 productos)
- 🍔 **Comidas rápidas**: Hamburguesas, Perros calientes, Sándwiches, Salchipapas, Nuggets (5 productos)
- 📚 **Útiles escolares**: Cuadernos, Lapiceros, Correctores, Marcadores (4 productos)

---

## 🚧 Funciones pendientes / próximos pasos

- [ ] Autenticación real con Firebase Auth o similar
- [ ] Notificaciones push reales con Firebase Cloud Messaging (FCM)
- [ ] Sistema de comentarios y reseñas reales por producto
- [ ] Carga real de imágenes de productos (almacenamiento cloud)
- [ ] Integración con APIs de pago reales (MercadoPago, PSE)
- [ ] Sistema de recomendaciones basado en historial
- [ ] Exportación de reportes en PDF/Excel
- [ ] Soporte multi-tienda
- [ ] App nativa con Capacitor o React Native

---

## 🛠️ Tecnologías utilizadas

- **HTML5** semántico con accesibilidad
- **CSS3** con variables, animaciones y modo oscuro
- **JavaScript ES6+** vanilla (sin frameworks)
- **Chart.js** para gráficos en el panel admin
- **Font Awesome** para iconografía
- **Inter** (Google Fonts) como tipografía
- **QR Server API** para generación de códigos QR
- **Web Audio API** para sonidos de notificación
- **Notifications API** para push nativas
- **Firebase Cloud Firestore** (o localStorage) para persistencia de datos

---

## 🎨 Paleta de colores

| Nombre | Color |
|--------|-------|
| Primario | `#6c3fc5` (Morado) |
| Secundario | `#ff6b35` (Naranja) |
| Acento | `#ffd60a` (Amarillo) |
| Éxito | `#22c55e` (Verde) |
| Peligro | `#ef4444` (Rojo) |
