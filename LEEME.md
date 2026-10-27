# Mis cuentas

Panel de finanzas con **dos espacios separados**:

- **🏠 Casa**: los gastos del hogar, con ING y la tarjeta Carrefour.
- **👤 Personal**: ING Nómina, ING Ahorro, Revolut, efectivo, Degiro y cripto, con patrimonio neto.

Se cambia de uno a otro con el selector de arriba del menú. Cada espacio tiene sus propios
movimientos, cuentas, categorías, reglas y presupuestos, y no se mezclan. El tema claro u
oscuro es el mismo para los dos. La **Vista global** (en el menú de los dos) los suma.

Funciona abriendo `index.html` con doble clic. No hay servidor, no hay instalación y
**ningún dato sale del ordenador**: todo se guarda en el `localStorage` del navegador.

## La app

**En el PC**: el acceso directo **Mis cuentas** (en el Escritorio y en el menú Inicio) la abre
en su propia ventana, como un programa, sin pestañas ni barra de direcciones. Usa tu perfil
de Edge, así que ves los mismos datos que abriendo `index.html`. Para tenerla en la barra de
tareas: con la ventana abierta, clic derecho en su icono → *Anclar a la barra de tareas*.

**En el móvil**: con la pantalla estrecha la app cambia sola de aspecto: barra de pestañas
abajo (Inicio, Movimientos, Cuentas o Tarjeta, Global y Más) y el menú completo plegado en ☰.
Los dashboards salen en **vista simple**:

| Vista simple | Qué enseña |
|---|---|
| **Casa** | Lo gastado en el mes (y frente al anterior), el presupuesto, ingresos, ahorro, en qué se va, el saldo de ING y lo que lleva la tarjeta, el colchón y los últimos movimientos. |
| **Personal** | El patrimonio neto, el mes (ingresos, gastos, ahorrado), dónde está tu dinero con lo que ganan las inversiones, en qué se va, el colchón y los últimos movimientos. |
| **Vista global** | El patrimonio total, el mes de los dos espacios juntos y el gasto de cada uno. |

Con ‹ › se cambia de mes. *Ver el dashboard completo* enseña el de siempre (y el móvil lo
recuerda); *📱 Vista simple* vuelve.

Para **instalarla en el móvil** hace falta abrirla desde una dirección web (https): el móvil no
puede abrir `index.html` desde una carpeta. Se publica en GitHub Pages, como Hábitos y Japón:
**https://alexlobar.github.io/MisCuentas/**. Lo que se sube es solo el programa, nunca tus datos.

### Publicar o actualizar en GitHub

1. Ejecuta `preparar-github.ps1` (clic derecho → *Ejecutar con PowerShell*). Comprueba que la
   versión coincide en los tres sitios y deja en `para-subir-a-github/` solo lo publicable:
   sin `ejemplos/` (llevan nombres reales) ni este LEEME.
2. En GitHub, repositorio **MisCuentas** (público: GitHub Pages gratis lo exige) → *Add file →
   Upload files* → arrastra **el contenido** de `para-subir-a-github/` (no la carpeta).
   La primera vez: *Settings → Pages → Deploy from a branch → main / (root)*.
3. En el móvil, abre la dirección **en Chrome** (no desde otra app) y recarga una o dos veces.
4. Pulsa **Instalar** en la app (sale arriba en Inicio y en *Ajustes → Esta instalación*). Es un
   botón propio porque el menú ⋮ → *Instalar app* de Chrome dice «ya está instalada» cuando
   hay otra app tuya instalada en `alexlobar.github.io` (ver `PWA-Android-ya-instalada.md`).
   En iPhone: Safari → *Compartir* → *Añadir a pantalla de inicio*.

**Versión**: va en tres sitios que deben coincidir. Súbela en los tres antes de publicar un
cambio, o el móvil puede seguir con la antigua: `APP_VERSION` en `js/app.js`, `VERSION` en
`sw.js` y `data-build` en `index.html`. Se ve en *Ajustes → Esta instalación*.

En el PC sigue usando el acceso directo: la dirección de GitHub es otro sitio para el
navegador y allí empezaría vacía.

**Tus datos no viajan solos entre el PC y el móvil**: cada uno guarda los suyos. Para
llevarlos, en el PC *Ajustes → Descargar copia*, deja el JSON en OneDrive y en el móvil
*Cargar copia de seguridad* (sale en la vista simple si está vacía, y en Ajustes).

## Empezar

1. Abre la app (el acceso directo o doble clic en `index.html`).
2. Elige el espacio (Casa o Personal).
3. Ve a **Importar** y suelta el extracto. Si lo reconoce, salta directo a confirmar.

Para probarlo sin tus datos reales están los ficheros de `ejemplos/`:
`ejemplo-ing-enero.csv` y `ejemplo-carrefour-enero.csv` para Casa;
`ejemplo-ing-personal-enero.csv` (nómina), `ejemplo-ing-ahorro-enero.csv` (ahorro),
`ejemplo-revolut-enero.csv` y `ejemplo-degiro-estado-de-cuenta.csv` para Personal.

## El espacio Personal

Sus cuentas son de dos tipos, y el dashboard enseña las dos cosas:

| Cuenta | Tipo | Cómo entra |
|---|---|---|
| **ING Nómina** | liquidez | importando el extracto (el mismo formato que en Casa) |
| **ING Ahorro** | liquidez | igual; la app sabe a cuál va cada extracto por su número de cuenta |
| **Revolut** | liquidez | importando el extracto CSV (se reconoce solo) |
| **Efectivo** | liquidez | a mano, con **＋ Apuntar a mano**, o subiendo tu Excel de gastos; los reintegros suman solos |
| **Degiro** | inversión | lo aportado sale solo de ING/Revolut (o de tus operaciones); el valor, a mano o leyendo la cartera |
| **Cripto** | inversión | igual: aportado solo, valor a mano (con nota por exchange: BingX, MEXC…) |

Las de **liquidez** son dinero que entra y sale: de ahí salen los ingresos y gastos. Las de
**inversión** no son gasto: son patrimonio. Para ellas importa cuánto has puesto (aportado)
y cuánto vale hoy (valoración). Si aún no la has valorado, cuenta lo aportado.

**Patrimonio neto** = saldo de las dos ING + Revolut + efectivo + valor de Degiro + valor de
cripto. El gráfico muestra cómo ha cambiado al cierre de cada mes.

### Dos cuentas del mismo banco (ING Nómina e ING Ahorro)

El extracto de ING trae en la cabecera el número de cuenta (IBAN). La **primera vez** que
importas una cuenta, el asistente te pregunta a cuál va (*ING Nómina* o *ING Ahorro*) y se
guarda su número. A partir de ahí, cada extracto **va solo a su cuenta**. En *Cuentas e
inversiones* se ve qué número tiene asociado cada una (••2109, ••3344…).

Si un extracto no trae el número, se usa la cuenta elegida en «Origen» antes de soltar el
fichero, y en el paso de confirmar puedes cambiarla. Los traspasos entre las dos cuentas se
emparejan solos, igual que con Revolut.

### Traspasos entre tus cuentas

Es lo que evita que recargar Revolut o comprar en Degiro cuente como gasto:

- **Se emparejan solos**: si el mismo importe sale de una cuenta tuya y entra en otra en
  3 días o menos (ING −200 el 03/01 y Revolut +200 el 03/01), los dos quedan como traspaso.
  Si aún no has importado la otra cuenta, el movimiento ya no cuenta como gasto y queda
  marcado como *sin pareja* hasta que la importes.
- **Se apuntan solos** en las cuentas sin extracto: un *reintegro* en ING suma al efectivo,
  lo que mandas a *Degiro* suma a lo aportado en Degiro, y lo que mandas a *BingX* o *MEXC*
  suma a lo aportado en cripto.
- Si alguno no lo es, en su menú (⋯) está **No es un traspaso: separar**. Y al revés:
  puedes marcar a mano que algo es un traspaso con otra cuenta tuya.

Las reglas de Personal tienen una columna más, **Cuenta de enfrente**, que es la que hace
todo esto. Si cambias de exchange, añade su nombre a la regla de cripto.

### Revolut

En la app: cuenta en euros → «…» → *Extracto* → formato Excel/CSV. Al importar:

- Solo entra lo **completado**: lo revertido, rechazado o pendiente se descarta.
- La **comisión** va como gasto aparte (categoría *Comisiones*). Así un reintegro de 40 € con
  1,50 € de comisión suma 40 € al efectivo, y el saldo sigue cuadrando con el extracto.
- Lo que va en **otra moneda** se guarda, pero fuera de los totales y con una nota, hasta
  que revises el importe en euros.

### Degiro

En *Cuentas e inversiones* puedes poner el valor a mano o subir la exportación de la cartera
(Degiro → Cartera → Exportar → CSV). La app suma la columna «Valor en EUR», incluido el
efectivo que tengas dentro de Degiro, y te enseña el total antes de guardarlo.
Si ya tenías dinero en Degiro o en cripto antes de usar la app, ponlo en
**Aportado antes de empezar a usar la app**.

**Dividendos y comisiones**: sube el *estado de cuenta* (Degiro → Actividad → Estado de
cuenta → Exportar → CSV). Se cogen los dividendos, su retención, las comisiones y los
intereses; las compras, ventas e ingresos se saltan (lo aportado ya sale de ING). Te enseña
el resumen antes de guardarlo, y si lo subes dos veces no duplica nada. Lo que venga en otra
moneda (un dividendo en dólares) se guarda aparte, sin sumar.

Esto **no cambia** lo aportado ni el valor (eso lo da la valoración): sirve para ver cuánto
te han dado los dividendos y cuánto se ha llevado Degiro en comisiones.

**Compras y ventas (tu Excel de operaciones)**: en la tarjeta de Degiro, *Importar
operaciones*, o soltándolo directamente en *Importar* (se reconoce solo). Vale el `.xlsx`
tal cual, con las columnas por su nombre o, si no tiene cabecera, en este orden:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Fecha | Compra o venta | Símbolo | Cantidad | Comisiones | % invertido (se ignora) | Tipo de cambio | Precio por acción en € | Precio por acción en $ | Total |

También vale el *Transactions.csv* de Degiro (Actividad → Transacciones → Exportar). Con eso:

- **Cartera**: qué acciones tienes, cuántas, a qué **precio medio** (con la comisión de compra
  dentro) y cuánto te costaron.
- **Ganancia realizada al vender**, casando cada venta con las compras más antiguas
  (**FIFO**, como Hacienda), y **por año**, para la casilla de la declaración de la renta.
- Si el historial de ING no llega a tus primeras compras, **lo aportado** sale de las compras
  y ventas. Si prefieres fijarlo tú, pon *Aportado antes de empezar* y *¿Desde cuándo?*.
- Las comisiones de compraventa no se cuentan dos veces si además subes el estado de cuenta.
- El valor de hoy de cada acción no lo sabe (la app no se conecta a internet): el valor total
  sigue saliendo de la valoración.

### Rentabilidad anual

En cada inversión y en la tabla del dashboard (columna **Al año**): la **TIR** (la «XIRR» de
Excel), que tiene en cuenta **cuándo** metiste cada euro. 1.000 € que llevan dos años dentro
no pesan lo mismo que 1.000 € del mes pasado, así que es más justa que el % total.
Se calcula con tus aportaciones (o tus operaciones) hasta la última valoración. Con menos de
6 meses de datos no se anualiza (saldría engañosa) y se enseña lo ganado en ese tiempo; con
menos de un año sale marcada como *orientativa*.

### Efectivo desde un Excel

Si llevas tus gastos en efectivo en un Excel, elige **Origen: Efectivo** en *Importar* (o
*Importar Excel* en la tarjeta del efectivo) y súbelo. Basta con fecha, concepto e importe:

- Si los importes van en positivo, se toman como gastos.
- Si tiene una columna **Categoría** con los mismos nombres que la app (da igual mayúsculas
  o tildes), se respeta; si no, clasifican las reglas.
- No se duplica lo que ya creó solo un reintegro de ING ni lo que ya apuntaste a mano
  (mismo día e importe).

## Gasto fijo y variable

Cada categoría de gasto puede marcarse como **fija** (lo pagas sí o sí cada mes) en
*Categorías y reglas*, columna *Fijo*. Vienen marcadas:

- **Casa**: vivienda, luz, agua, gas, telefonía, suministros, seguros, suscripciones y educación.
- **Personal**: universidad (categoría nueva, con su regla) y suscripciones.

En el dashboard, la tarjeta *Gasto fijo y variable* reparte el gasto del periodo, lista lo fijo
por categoría y da el gasto fijo medio de los últimos meses.

## Suscripciones y recibos

Página propia en los dos espacios. Detecta sola los cargos que se repiten: el mismo comercio
cobrando **cada mes, cada 3 meses o cada año** (desde 2 meses de datos).

- *Importe fijo*: suscripciones y cuotas (Spotify, Netflix, la universidad…), con lo que
  cuestan al año y cuándo toca el próximo cargo.
- *Importe variable*: recibos que se repiten pero cambian (luz, teléfono…), con su media.
- **¿Baja?**: si ya tocaba otro cargo y no ha llegado, te avisa (¿la diste de baja?).
- Lo que se compra varias veces al mes (el súper) no cuenta como suscripción. Y si algo se
  cuela, **No es recurrente** lo quita de la lista (y *Volver a incluir* lo recupera).

## Colchón de seguridad

En el dashboard de los dos espacios: **cuántos meses aguantas** con el dinero disponible
(las cuentas de liquidez, sin inversiones ni la tarjeta) al ritmo de gasto de los últimos
3 meses completos. Pones tu meta (6 meses por defecto) y te dice cuánto te falta o te sobra.
También dice cuánto aguantarías pagando solo lo fijo.

## Recordatorio de importar

El dashboard avisa de las cuentas que llevan **más de 35 días sin datos**, y junto a
*Importar* sale cuántas son. Cada aviso tiene su botón (*Importar*, *Valorar*, *Apuntar*):

- Cuentas del banco: hasta qué fecha llega el último extracto.
- Degiro y cripto: cuándo fue la última valoración.
- Efectivo: si sacas del cajero y en una semana no apuntas en qué, te lo recuerda.

*Más tarde* lo oculta una semana. En *Ajustes* cambias los días y desmarcas las cuentas que
no quieras que te recuerde. En *Importar* hay una tabla con cómo va cada cuenta.

## Vista global

Suma Casa y Personal sin mezclar sus datos: patrimonio total, ingresos, gastos y ahorro del
periodo; gasto por mes de cada espacio; patrimonio total mes a mes; y la tabla por espacio.
Si algún día pasas dinero entre Casa y Personal, ponle la categoría *Traspaso entre cuentas*
en los dos lados para que no cuente como gasto en uno e ingreso en el otro.

## Cómo sacar el extracto

**ING** → banca online → la cuenta → Movimientos → rango de fechas (p. ej. 01/01 a 31/01)
→ descargar. Si baja un `.xls`, ábrelo en Excel y guárdalo como *CSV (delimitado por
puntos y comas)*. También vale seleccionar las filas en Excel, copiarlas y pegarlas en el
cuadro de texto del importador.

**Tarjeta Carrefour** → área de cliente → movimientos del periodo → exportar, o copiar y
pegar la lista de la pantalla.

Formatos que lee: **Excel `.xlsx`** (si tiene varias hojas, coge la de la tabla), CSV, TXT,
TSV, tablas HTML y pegado desde Excel. El `.xls` del Excel antiguo hay que guardarlo antes
como `.xlsx` o CSV. PDF no.

### Importación automática

Los dos extractos habituales están guardados como **perfiles de columnas**, así que no hay
que ir señalando celdas: si el fichero encaja, el asistente salta directo a confirmar.

| Perfil | Columnas |
|---|---|
| **ING** | A Fecha valor · B Categoría · C Subcategoría · D Descripción · E Comentario · F Importe · G Saldo |
| **Tarjeta Carrefour** | A Fecha · B Concepto · C Modo de pago · D Cargo/abono · E Tarjeta |

De ING se usan D como concepto, F como importe y G como saldo; B, C y E se guardan como
dato extra y se ven como etiqueta gris en la tabla. De la tarjeta, C y E son el dato extra.
En la tarjeta el cargo viene en positivo: si la mayoría de los importes son positivos se les
da la vuelta al signo, de forma que los cargos quedan como gasto y los abonos como ingreso.

Si el fichero no encaja con ningún perfil, el asistente sigue pidiendo el mapeo a mano como
siempre. Y aunque lo reconozca, el botón *Revisar columnas* permite cambiarlo.

### Filas desplazadas

En algunos CSV hay movimientos cuyo concepto lleva un `;` sin comillas. Eso parte la celda
en dos y todo lo que viene detrás se corre una columna (la C pasa a la D, la D a la E…). Al
importar se detectan esas filas, se vuelve a juntar lo sobrante con el concepto y se
comprueba que la fecha y el importe caigan donde deben. El asistente avisa de cuántas filas
ha recolocado, y de las que no haya podido arreglar.

## Las páginas

| Página | Para qué |
|---|---|
| **Dashboard** | Casa: ingresos, gastos, balance y tasa de ahorro; gráficos por mes, categoría y comercio; saldo de ING. Personal: patrimonio neto, ingresos, gastos, ahorro e inversión; dónde está tu dinero; inversiones; traspasos. En los dos: gasto fijo y variable, y colchón de seguridad. |
| **Vista global** | Casa y Personal sumados: patrimonio, ingresos, gastos, ahorro y su evolución. |
| **Suscripciones y recibos** | Cargos que se repiten, detectados solos, con su coste al año y avisos de posibles bajas. |
| **Movimientos** | La tabla completa: filtros por periodo, texto, categoría, tipo y cuenta; orden por columna; cambiar la categoría en línea; selección múltiple; apuntar a mano; exportar a CSV. |
| **Tarjeta Carrefour** *(Casa)* | Lo mismo, pero solo con las líneas de la tarjeta. |
| **Cuentas e inversiones** *(Personal)* | Saldo de cada cuenta, efectivo inicial, valoraciones de Degiro y cripto, aportaciones, rentabilidad anual, dividendos y comisiones, cartera por operaciones y ganancias por año. |
| **Presupuesto** | Límite mensual por categoría, cuánto llevas gastado y la tabla del año entero (categorías × meses). |
| **Categorías y reglas** | Las reglas que clasifican solas, el bloque de "sin clasificar bien" y el alta/edición de categorías. |
| **Importar** | El asistente de 3 pasos y cómo va cada cuenta. |
| **Ajustes** | Copia de seguridad, nombres de las cuentas, recordatorio de importar y borrado. |

## Cómo clasifica

Cada movimiento pasa por la lista de reglas de arriba abajo y se queda con **la primera que
casa**. Una regla es una lista de palabras separadas por `|` (por ejemplo
`mercadona|lidl|alcampo`). Por eso el orden importa: "gasolinera carrefour" está antes que
"carrefour" y acaba en Transporte, no en Alimentación.

### Suministros de la casa

Luz, agua, gas y telefonía van cada uno por su lado, no en un cajón común:

| Categoría | Qué cae ahí |
|---|---|
| **Luz** | Naturgy, Iberdrola, Endesa, Curenergía, Holaluz, TotalEnergies, Octopus… |
| **Agua** | Canal de Isabel II, Aqualia, Emasesa, Hidrogea, "aguas de…" |
| **Gas** | Comercializadora Regulada, Nedgia, Redexis, Madrileña Red de Gas, gas natural |
| **Telefonía e internet** | Movistar, Vodafone, Orange, Digi, Pepephone, Lowi… |

La regla del gas va antes que la de la luz, porque "Comercializadora Regulada" es gas.
Ojo con un caso: como Naturgy está en la regla de **Luz**, si Naturgy también te factura el
gas ese recibo caerá en Luz. Si pasa, añade en *Categorías y reglas* una regla `naturgy gas`
→ Gas y súbela por encima de la de Luz con la flecha ↑.

- Si cambias la categoría a mano, queda marcada con ✎ y **Reaplicar reglas** no la pisa.
- En *Categorías y reglas*, el bloque de arriba agrupa lo que cayó en "Otros": al asignarle
  categoría se crea la regla sola para los próximos extractos.

### El doble conteo de la tarjeta

Si pagas la tarjeta Carrefour desde ING, ese recibo aparece en el extracto del banco *y* las
compras aparecen otra vez en el extracto de la tarjeta. Para que no se cuente dos veces, el
recibo se clasifica como **Pago tarjeta**, que es de tipo *traspaso*: los traspasos no suman
ni como ingreso ni como gasto. El gasto real lo aportan las líneas de la tarjeta.

Lo mismo vale para los traspasos entre cuentas propias y las aportaciones a ahorro.

## Duplicados

Al importar se comparan fecha + importe + concepto contra lo que ya hay. Si vuelves a subir
un mes que ya estaba, aparece como *duplicado* y no se añade. Si un día tienes de verdad dos
compras idénticas, se respetan las dos.

## Copia de seguridad

Los datos viven en el navegador de este equipo. Si borras los datos de navegación, los
pierdes. En **Ajustes → Descargar copia (JSON)** te llevas **los dos espacios** (movimientos,
reglas, categorías, presupuestos, valoraciones y operaciones) y se restaura desde ahí. Las copias
antiguas, que solo tenían Casa, también se pueden restaurar.

Los botones de borrar de Ajustes solo afectan al espacio en el que estás.

## Ficheros

```
index.html        estructura y menú
css/styles.css    estilos, tema claro/oscuro
js/store.js       datos, categorías, reglas y cálculos
js/xlsx.js        lector de Excel (.xlsx) sin librerías
js/parse.js       lectura de CSV, fechas e importes, operaciones de Degiro
js/charts.js      gráficos en SVG, sin librerías
js/app.js         páginas, vista simple del móvil e interacción
manifest.webmanifest, sw.js   para instalarla en el móvil y que funcione sin conexión
icons/            iconos de la app (y el .ico del acceso directo del PC)
preparar-github.ps1   prepara para-subir-a-github/ (lo que se publica)
ejemplos/         extractos de muestra para probar
```
