# Manual de Identidad de Marca — Cine con Criterio
*Versión 1.0 — Calibrada para Entornos Digitales y Dark Mode Nativo*

---

## 1. Concepto y Territorio Visual

### Metáfora visual central y racional creativo
La identidad de **Cine con Criterio** se edifica sobre la metáfora del **«Cuarto Oscuro del Editor»**. 

Es la zona de colisión entre la proyección cinematográfica (**luz sobre oscuridad**) y la disciplina de la prensa cultural (**tinta sobre papel**). 

* **Diferenciación con Música con Criterio (MCC):** Mientras MCC vibra desde lo sonoro, lo escénico y la calidez del vinilo, Cine con Criterio opera desde la penumbra de la butaca y la precisión del guion. 
* **El Seudónimo «El Selector»:** Asume el rol de un curador silencioso, analítico y archivista. Se distancia deliberadamente del DJ de pista para erigirse como un editor de antologías visuales.

### Principios de diseño clave

1. **Estructura de Familia Inquebrantable:** El bloque `/ con Criterio` es un ancla inamovible en peso, posición y proporciones. La diferenciación de la vertical «Cine» recae exclusivamente en la palabra inicial y en el acento azul tinta.
2. **Racionalidad Industrial y Contraste:** El sistema opera en un entorno nativo **Dark Mode** de alto contraste (Deep Charcoal), soportado por retículas suizas, esquinas vivas (`radius 0`) y estructuras modulares que priorizan el afiche y el fotograma frente a cualquier adorno.
3. **Silencio Iconográfico:** Queda prohibido el uso de tropos musicales (discos, agujas, ondas sonoras, auriculares) o elementos de la marca hermana DonJuanCelektor. El lenguaje visual es estrictamente cinematográfico y literario (lentes, marcos anamórficos, miras de enfoque y tipografía de linotipo).

---

## 2. Sistema de Logotipo

### Arquitectura de Logotipos

```
Horizontal (Principal):
┌──────────────────────────────────────────────────────────┐
│   [ C I N E ]       /       [ c o n   C r i t e r i o ]  │
│   (Azul Tinta)   (15° eje)         (Blanco Roto)         │
└──────────────────────────────────────────────────────────┘

Apilado (Secundario / Compacto):
┌─────────────────────────┐
│   C I N E               │
│   / con Criterio        │
└─────────────────────────┘
```

* **Logotipo Principal (Horizontal):** Estructura tipográfica horizontal `[Cine] / [con Criterio]`. La palabra `Cine` adopta el color Tinta Digital / Azul Tinta, mientras que `/ con Criterio` permanece en Blanco Roto / Gris Crudo.
* **Versión Secundaria (Apilada):** Empleada en avatares, cabeceras móviles y formatos cuadrados.
* **Isotipo / Símbolo («El Selector»):** Monograma de la letra **«C»** cuya contraforma interna proyecta con exactitud las proporciones de un fotograma en relación de aspecto **2.35:1** (formato anamórfico de pantalla ancha), descartando la literalidad ingenua de los agujeros de celuloide de 35mm.
* **Versión de Reducción Mínima (Favicon):** Símbolo de la «C» anamórfica de alto contraste optimizado para renderizado en 16×16 px y 32×32 px sobre fondo `#0b0f17`.

### Racional Geométrico
* **Retícula:** Construida sobre un módulo base de 8px.
* **Altura de la X:** La altura de x de «Cine» es idéntica a la altura de x de «con Criterio».
* **Eje de Simetría (Slash):** La barra inclinada `/` mantiene un ángulo matemático invariable de **15°**, actuando como el divisor axial de toda la familia de marcas «con Criterio».

### Reglas de Aplicación
* **Área de Reserva:** La distancia mínima alrededor del logotipo equivale a la altura de la letra «C» mayúscula de la marca. Ningún elemento gráfico, borde o texto puede invadir esta zona.
* **Tamaño Mínimo:** 
  * Pantalla (Digital): 110px de ancho.
  * Impresión: 25mm de ancho.
* **Usos Prohibidos:**
  * ❌ No alterar kerning, fuente o peso del bloque ancla `/ con Criterio`.
  * ❌ No aplicar degradados cromáticos al logotipo.
  * ❌ No introducir el color ámbar/naranja de Música con Criterio en la marca de Cine.
  * ❌ No anexionar el seudónimo «El Selector» como parte del lockup; es una firma de autoría en el contenido, no un subtítulo del logo.

---

## 3. Paleta Cromática Calibrada (Accesibilidad Dark Mode WCAG)

Para resolver la incompatibilidad de contraste de los azules oscuros sobre fondos casi negros en interfaces digitales, la paleta se divide en roles técnicos estrictos:

| Rol del Color | Nombre Técnico | HEX | RGB | WCAG sobre `#0b0f17` | Uso Principal | Jerarquía |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fondo Base** | *Deep Charcoal* | `#0b0f17` | `11, 15, 23` | N/A (Lienzo) | Fondo general de la plataforma | 60% |
| **Superficie UI** | *Steel Slate* | `#111827` | `17, 24, 39` | N/A (Base UI) | Tarjetas, drawers, paneles y modales | 20% |
| **Borde Técnico** | *Charcoal Border* | `#1e293b` | `30, 41, 59` | N/A (Línea) | Bordes de 1px (radius 0), divisores | N/A |
| **Acento Profundo** | *Azul Tinta Puro* | `#1e3a8a` | `30, 58, 138` | Superficie sólida | Fondos de botones activos con texto blanco, badges | 10% |
| **Acento UI / Luz** | *Tinta Digital* | `#3b82f6` | `59, 130, 246` | **4.8:1 (AA Normal / AAA Grande)** | Enlaces activos, estados hover, focus ring, marca | 5% |
| **Acento Texto UI** | *Tinta Luminosa* | `#60a5fa` | `96, 165, 250` | **7.4:1 (AAA)** | Metadatos H3 en dark mode, etiquetas de director | 5% |
| **Texto Primario** | *Blanco Roto* | `#f8fafc` | `248, 250, 252` | **16.8:1 (AAA)** | Títulos principales, cuerpo editorial | Texto |
| **Texto Secundario**| *Gris Archivo* | `#94a3b8` | `148, 163, 184` | **6.5:1 (AAA)** | Sinopsis, metadatos secundarios, fechas | Texto |

> [!NOTE]
> **Calibración Térmica:** Se reemplazó el tono cálido `#1c1917` por el carbón frío/acero `#111827` para mantener una armonía cromática con la base `#0b0f17` y evitar aberraciones visuales en paneles OLED.
> 
> **Regla de Accesibilidad:** El *Azul Tinta Puro* (`#1e3a8a`) se usa como **color de fondo/superficie**, mientras que *Tinta Digital* (`#3b82f6` / `#60a5fa`) se emplea para **elementos de línea, iconos y texto legible**.

---

## 4. Sistema Tipográfico

La arquitectura tipográfica se apoya en una tríada armónica de Google Fonts:

```
┌────────────────────────────────────────────────────────┐
│  INTER           → Estructura, Headings (H1/H2), Logo  │
│  LORA            → Voz Crítica, Reseñas, Ensayos, Citas│
│  JETBRAINS MONO  → Metadatos, Años, Duración, Chips UI │
└────────────────────────────────────────────────────────┘
```

### 1. Inter (Headings y Arquitectura UI)
* **Rol:** Marca base, navegación, botones, títulos estructurales H1 y H2.
* **Propiedades:** Tracking `-0.02em`, peso SemiBold (600) y Bold (700). Interlineado compacto (1.1 a 1.25).
* **Racional:** Pureza suiza, legibilidad de alta densidad y neutralidad técnica.

### 2. Lora (Voz Curatorial y Cuerpo Editorial)
* **Rol:** Reseñas de películas, notas editoriales de «El Selector», citas y ensayos críticos.
* **Propiedades:** Peso Regular (400) e Italic (400/500). Interlineado amplio (1.6 a 1.7) para lectura prolongada.
* **Racional:** Aporta la voz literaria y la herencia de las revistas clásicas de cine (*Cahiers du Cinéma*, *Sight & Sound*), balanceando la frialdad industrial de Inter.

### 3. JetBrains Mono (Metadatos Técnicos de Archivo)
* **Rol:** Fichas técnicas (Año, Director, Duración, Relación de Aspecto, Calificación, Timestamps, Códigos de Sala).
* **Propiedades:** Peso Regular (400) y Medium (500), `tabular-nums`, tamaño reducido (11px – 13px), tratamiento All-Caps con tracking `+0.08em` para microetiquetas.
* **Racional:** Conecta con las hojas de contacto, diagramas de claqueta y mesas de edición analógicas.

### Jerarquía Tipográfica Implementada
* **H1 (Títulos Principales / Portada):** Inter Bold, 32px – 40px, Line-height 1.1, Blanco Roto (`#f8fafc`).
* **H2 (Subtítulos / Bloques):** Inter SemiBold, 20px – 24px, Line-height 1.25, Blanco Roto.
* **H3 (Director / Año / Ficha):** JetBrains Mono Medium, 12px – 13px, All-Caps, Tinta Luminosa (`#60a5fa`).
* **Cuerpo Curatorial (Reseñas):** Lora Regular / Italic, 15px – 17px, Line-height 1.65, Blanco Roto al 90% (`#f8fafc`/90).
* **Chips / Metadatos UI:** JetBrains Mono Regular, 11px – 12px, Gris Archivo (`#94a3b8`) o Tinta Digital (`#3b82f6`).

---

## 5. Sistema de Iconografía e Ilustración

### Lenguaje Iconográfico Técnico
* **Estilo:** Trazo lineal continuo (Outline) de **1.5px**, esquinas vivas (**0px border-radius**), terminaciones rectas y ausencia total de remates redondeados o caricaturescos.
* **Retícula Base:** Cuadrícula de 24×24 px (con variantes a 16×16 px).
* **Color:** Blanco Roto (`#f8fafc`) por defecto; Tinta Digital (`#3b82f6`) en estado activo, hover o acento.

### Set Base de 6 Iconos Oficiales

1. **La Pluma y el Lente (Firma del Selector):** Plumín estilizado de tinta cuya ranura central abre en la silueta de un objetivo de cámara. Firma los textos de autoría de «El Selector».
2. **El Fotograma Anamórfico (2.35:1):** Marco rectangular estricto con relación 2.35:1. Identifica el catálogo, la biblioteca y las vistas de película.
3. **El Criterio (Estrella Destello de 4 Puntas):** Estrella afilada con destello anamórfico (*lens flare*) de 4 puntas, eliminando la estrella convencional de 5 puntas. Usada en el sistema de rating de 1 a 5.
4. **El Boleto (Ticket Angular):** Cupón geométrico con incisiones triangulares de corte limpio en 90°, sin curvas. Simboliza disponibilidad en plataformas / streaming.
5. **Cruz de Enfoque (Crosshair Analítico):** Retícula de visor con mira dividida y marcas milimétricas. Usada en el explorador de conexiones y análisis semántico.
6. **Eslabón Compartido (Link a Música con Criterio):** Dos rectángulos ortogonales entrelazados en ángulo de 45° (uno representa la onda sonora, el otro el fotograma). Icono exclusivo para el enlace cruzado a la plataforma hermana MCC.

---

## 6. Texturas y Acabados de Interfaz

* **Micro-retícula (Grid Overlay):** Trama sutil de 24×24 px o 32×32 px con opacidad del 2% al 3% sobre el fondo `#0b0f17`, evocando papel milimetrado de guion técnico y mesa de montaje.
* **Grano Cinemático (35mm Noise):** Capa procedural fija en CSS (`mix-blend-mode: screen`, opacidad 3.5%) que rompe la frialdad del renderizado vectorial plano.
* **Contenedores de Borde Vivo:** Tarjetas y contenedores con `border-radius: 0px` o micro-radio de 2px, borde nítido de `1px solid rgba(248, 250, 252, 0.08)`.
