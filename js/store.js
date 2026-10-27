/* ============================================================
   store.js — estado, persistencia en localStorage y utilidades
   Todo vive en el navegador. Nada sale del equipo.

   Hay dos ESPACIOS (Casa y Personal), cada uno con sus movimientos,
   cuentas, categorías, reglas y presupuestos, guardados por separado.
   ============================================================ */
(function (global) {
  'use strict';

  var SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];

  /* Casa sigue en su clave de siempre: los datos ya guardados no se mueven. */
  var SPACES = {
    casa:     { key: 'presupuesto-casa.v1',     label: 'Casa',     icon: '🏠' },
    personal: { key: 'presupuesto-personal.v1', label: 'Personal', icon: '👤' }
  };
  var SPACE_KEY = 'mis-cuentas.espacio';
  var THEME_KEY = 'mis-cuentas.tema';

  /* ============================================================
     CASA
     ============================================================ */
  /* tipo: 'gasto' | 'ingreso' | 'traspaso'
     Los 'traspaso' no cuentan como ingreso ni como gasto (movimientos
     entre cuentas propias, pago de la tarjeta, etc.).
     fixed: gasto fijo (lo pagas sí o sí cada mes); se cambia en Categorías. */
  var CASA_CATEGORIES = [
    { name: 'Vivienda',              type: 'gasto',    color: '--s1', fixed: true },
    { name: 'Alimentación',          type: 'gasto',    color: '--s3' },
    { name: 'Luz',                   type: 'gasto',    color: '--s4', fixed: true },
    { name: 'Agua',                  type: 'gasto',    color: '--s1', fixed: true },
    { name: 'Gas',                   type: 'gasto',    color: '--s2', fixed: true },
    { name: 'Telefonía e internet',  type: 'gasto',    color: '--s7', fixed: true },
    { name: 'Suministros',           type: 'gasto',    color: '--s6', fixed: true },
    { name: 'Transporte',            type: 'gasto',    color: '--s2' },
    { name: 'Salud',                 type: 'gasto',    color: '--s5' },
    { name: 'Ocio y restaurantes',   type: 'gasto',    color: '--s7' },
    { name: 'Compras',               type: 'gasto',    color: '--s8' },
    { name: 'Suscripciones',         type: 'gasto',    color: '--s6', fixed: true },
    { name: 'Educación',             type: 'gasto',    color: '--s1', fixed: true },
    { name: 'Seguros',               type: 'gasto',    color: '--s3', fixed: true },
    { name: 'Impuestos y tasas',     type: 'gasto',    color: '--s4' },
    { name: 'Comisiones bancarias',  type: 'gasto',    color: '--s8' },
    { name: 'Viajes',                type: 'gasto',    color: '--s5' },
    { name: 'Mascotas',              type: 'gasto',    color: '--s2' },
    { name: 'Efectivo',              type: 'gasto',    color: '--s7' },
    { name: 'Otros gastos',          type: 'gasto',    color: '--s6' },
    { name: 'Nómina',                type: 'ingreso',  color: '--s3' },
    { name: 'Otros ingresos',        type: 'ingreso',  color: '--s1' },
    { name: 'Traspaso entre cuentas',type: 'traspaso', color: '--s7' },
    { name: 'Pago tarjeta',          type: 'traspaso', color: '--s7' },
    { name: 'Ahorro / inversión',    type: 'traspaso', color: '--s1' }
  ];

  /* El orden importa: primero lo específico (pago de la tarjeta, gasolinera,
     farmacia…) y al final lo genérico, porque gana la primera que casa. */
  var CASA_RULES = [
    ['pago tarjeta|liquidacion tarjeta|liquidación tarjeta|recibo tarjeta|pass carrefour|servicios financieros carrefour|carrefour pass|oney', 'Pago tarjeta'],
    ['traspaso|transferencia a cuenta propia|entre cuentas|cuenta naranja', 'Traspaso entre cuentas'],
    ['aportacion fondo|aportación fondo|plan de pensiones|indexa|myinvestor|fondo inversion|fondo inversión|degiro|trade republic', 'Ahorro / inversión'],
    ['nomina|nómina|salario|paga extra|sueldo', 'Nómina'],
    ['reintegro|cajero|retirada efectivo|disposicion efectivo|disposición efectivo', 'Efectivo'],
    ['gasolinera|carburante|repsol e.s|repsol estacion|cepsa|galp|shell|petroprix|ballenoil|plenoil|estacion de servicio|estación de servicio|parking|aparcamiento|telepeaje|autopista|peaje|via-t|itv |taller mecanico|taller mecánico|neumaticos|neumáticos|renfe|alsa|metro de|emt madrid|uber|cabify|bolt |taxi|bicimad', 'Transporte'],
    ['farmacia|parafarmacia|clinica|clínica|hospital|dentista|dental|sanitas|adeslas|dkv|asisa|optica|óptica|fisioterapia|psicolog|analisis clinic|análisis clínic', 'Salud'],
    /* Suministros de la casa, cada uno por su lado. Van antes que nada genérico
       y el gas antes que la luz, porque "Comercializadora Regulada" es gas. */
    ['canal de isabel|canal isabel|emasesa|aqualia|hidrogea|aguas de|agua de|recibo agua|emivasa|emasa|sociedad de aguas', 'Agua'],
    ['comercializadora regulada|gas natural|nedgia|redexis|madrilena red de gas|madrileña red de gas|naturgas|repsol butano|cepsa gas|gas &', 'Gas'],
    ['naturgy|iberdrola|endesa|curenergia|curenergía|energia xxi|energía xxi|holaluz|octopus energy|totalenergies|repsol luz|repsol comercializadora|audax|lucera|som energia', 'Luz'],
    ['movistar|vodafone|orange|jazztel|yoigo|masmovil|másmóvil|pepephone|lowi|digi |finetwork|telefonica|telefónica|o2 ', 'Telefonía e internet'],
    ['basura|alcantarillado|recogida residuos', 'Suministros'],
    ['netflix|spotify|hbo|disney|amazon prime|prime video|dazn|apple.com/bill|itunes|google storage|google one|youtube premium|filmin|movistar plus|chatgpt|openai|anthropic|claude.ai|adobe|microsoft 365|dropbox|icloud', 'Suscripciones'],
    ['alquiler|hipoteca|prestamo hipotec|préstamo hipotec|comunidad de propietarios|comunidad prop|administracion de fincas|administración de fincas|leroy merlin|bricomart|bricodepot|ikea|bauhaus|ferreteria|ferretería', 'Vivienda'],
    ['mapfre|axa|allianz|linea directa|línea directa|mutua|zurich|generali|reale seguros|pelayo|caser|santalucia|santalucía|seguro ', 'Seguros'],
    ['colegio|universidad|matricula|matrícula|academia|libros de texto|guarderia|guardería|ampa |escuela', 'Educación'],
    ['veterinari|kiwoko|tiendanimal|mascota', 'Mascotas'],
    ['booking|airbnb|iberia|ryanair|vueling|easyjet|air europa|hotel |hostal|parador|logitravel|edreams|trivago|renfe ave|viajes el corte', 'Viajes'],
    ['restaurante|bar |cafeteria|cafetería|cerveceria|cervecería|mcdonald|burger king|telepizza|domino|kfc|goiko|foster|vips|starbucks|glovo|just eat|justeat|uber eats|ubereats|deliveroo|tapas|asador|pizzeria|pizzería|cines|cinesa|yelmo|teatro|museo|ticketmaster|entradas|padel|pádel|gimnasio|basic fit|altafit|vivagym|decathlon', 'Ocio y restaurantes'],
    ['mercadona|carrefour|lidl|aldi|dia %|alcampo|eroski|consum|ahorramas|supercor|frutería|carniceria|carnicería|panaderia|panadería|pescaderia|pescadería|supermercado|hipermercado', 'Alimentación'],
    ['amazon|aliexpress|shein|zara|mango|h&m|primark|el corte ingles|el corte inglés|mediamarkt|pccomponentes|worten|fnac|apple store|springfield|bershka|pull&bear|stradivarius|cortefiel|nike|adidas|zalando|temu', 'Compras'],
    ['hacienda|agencia tributaria|aeat|irpf|impuesto|tasa municipal|ayuntamiento|ibi |dgt|tráfico|trafico|seguridad social', 'Impuestos y tasas'],
    ['comision|comisión|mantenimiento cuenta|intereses|descubierto|cuota tarjeta|gastos administrat', 'Comisiones bancarias']
  ];

  /* ============================================================
     PERSONAL
     ============================================================ */
  var PERSONAL_CATEGORIES = [
    { name: 'Comida y súper',           type: 'gasto',    color: '--s3' },
    { name: 'Restaurantes y bares',     type: 'gasto',    color: '--s7' },
    { name: 'Ocio',                     type: 'gasto',    color: '--s5' },
    { name: 'Ropa y calzado',           type: 'gasto',    color: '--s8' },
    { name: 'Transporte',               type: 'gasto',    color: '--s2' },
    { name: 'Salud y cuidado personal', type: 'gasto',    color: '--s1' },
    { name: 'Deporte',                  type: 'gasto',    color: '--s6' },
    { name: 'Suscripciones',            type: 'gasto',    color: '--s4', fixed: true },
    { name: 'Tecnología',               type: 'gasto',    color: '--s7' },
    { name: 'Universidad',              type: 'gasto',    color: '--s3', fixed: true },
    { name: 'Formación',                type: 'gasto',    color: '--s1' },
    { name: 'Regalos',                  type: 'gasto',    color: '--s5' },
    { name: 'Viajes',                   type: 'gasto',    color: '--s2' },
    { name: 'Compras',                  type: 'gasto',    color: '--s8' },
    { name: 'Comisiones',               type: 'gasto',    color: '--s4' },
    { name: 'Impuestos',                type: 'gasto',    color: '--s6' },
    { name: 'Otros gastos',             type: 'gasto',    color: '--s6' },
    { name: 'Nómina',                   type: 'ingreso',  color: '--s3' },
    { name: 'Rendimientos',             type: 'ingreso',  color: '--s7' },
    { name: 'Otros ingresos',           type: 'ingreso',  color: '--s1' },
    { name: 'Traspaso entre cuentas',   type: 'traspaso', color: '--s7' },
    { name: 'Inversión',                type: 'traspaso', color: '--s7' }
  ];

  /* El tercer valor es la CUENTA DE ENFRENTE: si casa, el movimiento es un
     traspaso entre tus cuentas (y no un gasto). Una regla no se aplica a la
     propia cuenta de enfrente: "Revolut Premium" en Revolut no es un traspaso. */
  var PERSONAL_RULES = [
    ['degiro|flatex', 'Inversión', 'degiro'],
    ['bingx|mexc|binance|coinbase|bit2me|kraken|bitpanda|crypto.com', 'Inversión', 'cripto'],
    ['reintegro|cajero|retirada efectivo|retirada de efectivo|disposicion efectivo|disposición efectivo|cash withdrawal', 'Traspaso entre cuentas', 'efectivo'],
    ['revolut', 'Traspaso entre cuentas', 'revolut'],
    ['top-up|topup|top up|recarga de saldo', 'Traspaso entre cuentas', 'ing'],
    ['exchanged to|exchange to|cambio de divisa', 'Traspaso entre cuentas'],
    // sin "cuenta naranja": los intereses de la Cuenta Naranja son un ingreso, no un traspaso
    ['traspaso|transferencia a cuenta propia|entre cuentas', 'Traspaso entre cuentas'],
    ['nomina|nómina|salario|paga extra|sueldo', 'Nómina'],
    ['comision|comisión|intereses deudores|descubierto|cuota tarjeta|cuota de mantenimiento', 'Comisiones'],
    ['intereses|dividendo|remuneracion|remuneración|cashback', 'Rendimientos'],
    ['hacienda|agencia tributaria|aeat|irpf|impuesto|tasa municipal|dgt|multa', 'Impuestos'],
    // la comida a domicilio va antes que el transporte: "Uber Eats" no es un taxi
    ['uber eats|ubereats|glovo|just eat|justeat|deliveroo', 'Restaurantes y bares'],
    ['gasolinera|carburante|repsol e.s|repsol estacion|cepsa|galp|shell|petroprix|ballenoil|plenoil|estacion de servicio|estación de servicio|parking|aparcamiento|telepeaje|autopista|peaje|via-t|itv |taller mecanico|taller mecánico|renfe|alsa|metro de|emt |uber|cabify|bolt |free now|freenow|taxi|bicimad|blablacar', 'Transporte'],
    ['farmacia|parafarmacia|clinica|clínica|hospital|dentista|dental|sanitas|adeslas|dkv|asisa|optica|óptica|fisioterapia|psicolog|peluqueria|peluquería|barberia|barbería|estetica|estética|perfumeria|perfumería|druni|primor|sephora', 'Salud y cuidado personal'],
    ['gimnasio|basic fit|altafit|vivagym|mcfit|fitness|decathlon|padel|pádel|piscina|crossfit', 'Deporte'],
    ['netflix|spotify|hbo|disney|amazon prime|prime video|dazn|apple.com/bill|itunes|google storage|google one|youtube premium|filmin|chatgpt|openai|anthropic|claude.ai|adobe|microsoft 365|dropbox|icloud|patreon|twitch', 'Suscripciones'],
    ['booking|airbnb|iberia|ryanair|vueling|easyjet|air europa|hotel |hostal|parador|logitravel|edreams|trivago|renfe ave|ouigo|iryo', 'Viajes'],
    ['universidad|university|universitat|uned|cunef|esic|icade|comillas|ceu |matricula|matrícula|facultad|campus', 'Universidad'],
    ['udemy|coursera|domestika|platzi|academia|casa del libro|libreria|librería|kindle|audible', 'Formación'],
    ['apple store|mediamarkt|pccomponentes|worten|fnac|xiaomi|samsung|steam|playstation|nintendo|xbox|gamestop', 'Tecnología'],
    ['restaurante|bar |cafeteria|cafetería|cerveceria|cervecería|mcdonald|burger king|telepizza|domino|kfc|goiko|foster|vips|starbucks|tapas|asador|pizzeria|pizzería|taberna|tasca|sushi|kebab', 'Restaurantes y bares'],
    ['cines|cinesa|yelmo|teatro|museo|ticketmaster|entradas|concierto|discoteca|bolera|escape room', 'Ocio'],
    ['zara|mango|h&m|primark|springfield|bershka|pull&bear|stradivarius|cortefiel|nike|adidas|zalando|shein|massimo dutti|uniqlo|foot locker|zapateria|zapatería', 'Ropa y calzado'],
    ['floristeria|floristería|interflora|regalo|jugueteria|juguetería', 'Regalos'],
    ['mercadona|carrefour|lidl|aldi|dia %|alcampo|eroski|consum|ahorramas|supercor|supermercado|hipermercado|fruteria|frutería|panaderia|panadería', 'Comida y súper'],
    ['amazon|aliexpress|temu|el corte ingles|el corte inglés|ikea|leroy merlin', 'Compras']
  ];

  var VERSION = 3;

  function defaultState(sp) {
    sp = sp || space;
    var personal = sp === 'personal';
    var cats = personal ? PERSONAL_CATEGORIES : CASA_CATEGORIES;
    var rules = personal ? PERSONAL_RULES : CASA_RULES;
    return {
      version: VERSION,
      space: sp,
      movements: [],
      valuations: [],              // valoraciones de cuentas de inversión: {id, account, date, value, note}
      categories: cats.map(function (c) { return Object.assign({}, c); }),
      rules: rules.map(function (r, i) {
        var o = { id: uid(), pattern: r[0], category: r[1], enabled: true, order: i, builtin: true };
        if (r[2]) o.counterpart = r[2];
        return o;
      }),
      budgets: {},                 // { "Alimentación": 400, ... } importe mensual
      /* kind: 'liquidez' (dinero que entra y sale) o 'inversion' (patrimonio).
         importable: si hay extracto que subir; si no, se apunta a mano y los
         traspasos hacia ella se crean solos. */
      /* bank: de qué banco es el extracto. Si hay dos cuentas del mismo banco
         (ING Nómina e ING Ahorro), el IBAN del extracto dice cuál es cuál.
         noBalance: no tiene saldo propio (la tarjeta), no entra en el patrimonio. */
      accounts: personal ? {
        ing:       { label: 'ING Nómina', color: '--s2', kind: 'liquidez',  importable: true, bank: 'ing' },
        ingAhorro: { label: 'ING Ahorro', color: '--s5', kind: 'liquidez',  importable: true, bank: 'ing' },
        revolut:   { label: 'Revolut',    color: '--s1', kind: 'liquidez',  importable: true, bank: 'revolut' },
        efectivo:  { label: 'Efectivo',   color: '--s3', kind: 'liquidez',  importable: false, opening: 0 },
        degiro:    { label: 'Degiro',     color: '--s7', kind: 'inversion', importable: false, openingInvested: 0 },
        cripto:    { label: 'Cripto',     color: '--s4', kind: 'inversion', importable: false, openingInvested: 0 }
      } : {
        ing:       { label: 'ING',               color: '--s2', kind: 'liquidez', importable: true, bank: 'ing' },
        carrefour: { label: 'Tarjeta Carrefour', color: '--s1', kind: 'liquidez', importable: true, bank: 'carrefour', noBalance: true }
      },
      settings: { pageSize: 50, cushionMonths: 6, remindDays: 35 },
      recurringIgnored: [],        // claves de cargos que dijiste que no son recurrentes
      trades: [],                  // compras y ventas de acciones: {id, account, date, side, symbol, key, qty, gross, fee, …}
      lastImport: null
    };
  }

  var state = null;
  var space = readSpace();

  function readSpace() {
    try { var s = localStorage.getItem(SPACE_KEY); return SPACES[s] ? s : 'casa'; }
    catch (e) { return 'casa'; }
  }

  function load() {
    try {
      var raw = localStorage.getItem(SPACES[space].key);
      if (!raw) { state = defaultState(space); return state; }
      var parsed = JSON.parse(raw);
      var base = defaultState(space);
      var def = defaultState(space);       // copia limpia: "base" queda pisada por lo guardado
      state = Object.assign(base, parsed);
      state.space = space;
      // las cuentas se mezclan una a una, para que las guardadas reciban los
      // campos nuevos (tipo de cuenta, si se importa…) sin perder su nombre
      var cuentas = {};
      Object.keys(def.accounts).forEach(function (k) {
        cuentas[k] = Object.assign({}, def.accounts[k], (parsed.accounts || {})[k] || {});
      });
      Object.keys(parsed.accounts || {}).forEach(function (k) {
        if (!cuentas[k]) cuentas[k] = Object.assign({ kind: 'liquidez', importable: true }, parsed.accounts[k]);
      });
      state.accounts = cuentas;
      state.settings = Object.assign(def.settings, parsed.settings || {});
      if (!Array.isArray(state.movements)) state.movements = [];
      if (!Array.isArray(state.valuations)) state.valuations = [];
      if (!Array.isArray(state.recurringIgnored)) state.recurringIgnored = [];
      if (!Array.isArray(state.trades)) state.trades = [];
      if (!state.budgets || typeof state.budgets !== 'object') state.budgets = {};
      if (!Array.isArray(state.categories) || !state.categories.length) state.categories = base.categories;
      if (!Array.isArray(state.rules)) state.rules = base.rules;
      if (migrate()) save();
      return state;
    } catch (e) {
      console.error('No se pudo leer el almacenamiento local', e);
      state = defaultState(space);
      return state;
    }
  }

  /** Cambia de espacio: guarda el actual y carga el otro. */
  function setSpace(sp) {
    if (!SPACES[sp] || sp === space) return state;
    if (state) save();
    space = sp;
    try { localStorage.setItem(SPACE_KEY, sp); } catch (e) { /* noop */ }
    return load();
  }

  /* ---------- Migraciones entre versiones del fichero guardado ----------
     Devuelve true si ha cambiado algo (para guardarlo). */
  function migrate() {
    var changed = false;

    /* v1 -> v2 (solo Casa): Luz, Agua, Gas y Telefonía salen de "Suministros" */
    if (space === 'casa' && (state.version || 1) < 2) {
      var base = defaultState('casa');
      var nuevas = ['Luz', 'Agua', 'Gas', 'Telefonía e internet'];

      nuevas.forEach(function (n) {
        if (getCategory(n)) return;
        var proto = base.categories.filter(function (c) { return c.name === n; })[0];
        if (proto) state.categories.push(Object.assign({}, proto));
      });

      // las reglas nuevas ocupan el sitio de la antigua regla de Suministros
      var nuevasReglas = base.rules.filter(function (r) {
        return nuevas.indexOf(r.category) !== -1 ||
          (r.category === 'Suministros' && String(r.pattern).indexOf('basura') === 0);
      });
      var vieja = -1;
      state.rules.forEach(function (r, i) {
        if (r.builtin && r.category === 'Suministros' && String(r.pattern).indexOf('iberdrola') !== -1) vieja = i;
      });
      var at = vieja >= 0 ? (state.rules[vieja].order || 0) : -1;
      if (vieja >= 0) state.rules.splice(vieja, 1);
      nuevasReglas.forEach(function (r, k) {
        r.order = at + k * 0.001;
        state.rules.push(r);
      });
      state.rules.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      state.rules.forEach(function (r, i) { r.order = i; });

      // reclasifica lo que cayó en Suministros y no se tocó a mano
      state.movements.forEach(function (m) {
        if (m.manual) return;
        if (m.category === 'Suministros' || !m.category) {
          m.category = matchRule(m.concept + ' ' + (m.extra || ''), m.amount);
        }
      });

      state.version = 2;
      changed = true;
    }

    /* v2 -> v3 (los dos espacios): gasto fijo, Universidad, ING Ahorro */
    if ((state.version || 1) < 3) {
      var d3 = defaultState(space);
      var fijas = {};
      d3.categories.forEach(function (c) { if (c.fixed) fijas[c.name] = true; });
      // la marca de fijo solo se pone si la categoría aún no la tiene
      state.categories.forEach(function (c) { if (c.fixed === undefined) c.fixed = !!fijas[c.name]; });
      // categorías nuevas del espacio, junto a su vecina natural
      d3.categories.forEach(function (c, i) {
        if (getCategory(c.name)) return;
        var antes = i > 0 ? d3.categories[i - 1].name : null;
        var pos = -1;
        state.categories.forEach(function (x, j) { if (x.name === antes) pos = j; });
        state.categories.splice(pos >= 0 ? pos + 1 : state.categories.length, 0, Object.assign({}, c));
      });
      // reglas nuevas (Universidad), justo antes de la de Formación
      d3.rules.forEach(function (r) {
        var existe = state.rules.some(function (x) { return x.category === r.category && x.pattern === r.pattern; });
        if (existe || r.category !== 'Universidad') return;
        var ref = state.rules.filter(function (x) { return x.category === 'Formación'; })[0];
        r.order = ref ? (ref.order || 0) - 0.5 : -1;
        state.rules.push(r);
      });
      state.rules.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      state.rules.forEach(function (r, i) { r.order = i; });
      if (space === 'personal' && state.accounts.ing && state.accounts.ing.label === 'ING') state.accounts.ing.label = 'ING Nómina';
      if (space === 'personal') {
        state.rules.forEach(function (r) {
          if (r.builtin && r.category === 'Traspaso entre cuentas') r.pattern = String(r.pattern).replace('|cuenta naranja', '');
        });
      }
      // lo que ahora encaja en una categoría nueva se reclasifica (sin tocar lo puesto a mano)
      state.movements.forEach(function (m) {
        if (m.manual || m.pairId || m.auto) return;
        var r3 = matchRuleFull(m.concept + ' ' + (m.extra || ''), m.amount, m.source);
        if (r3.category === 'Universidad') m.category = r3.category;
        // lo que solo era "traspaso" por decir "cuenta naranja" vuelve a su sitio
        else if (space === 'personal' && m.category === 'Traspaso entre cuentas' && !m.counterpart &&
                 /cuenta naranja/.test(normalize(m.concept + ' ' + (m.extra || ''))) && !/traspaso/.test(normalize(m.concept))) {
          m.category = r3.category;
        }
      });
      state.version = 3;
      changed = true;
    }

    return changed;
  }

  function save() {
    try {
      localStorage.setItem(SPACES[space].key, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error(e);
      if (global.App && global.App.toast) {
        global.App.toast('No se pudo guardar: almacenamiento lleno. Exporta y limpia datos antiguos.', 'bad');
      }
      return false;
    }
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /* ---------- Tema (común a los dos espacios) ---------- */
  function getTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t) return t;
      // antes el tema se guardaba dentro de Casa: se trae una vez y vale para los dos
      var c = JSON.parse(localStorage.getItem(SPACES.casa.key) || '{}');
      if (c.settings && c.settings.theme) {
        localStorage.setItem(THEME_KEY, c.settings.theme);
        return c.settings.theme;
      }
    } catch (e) { /* noop */ }
    return 'auto';
  }
  function setTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* noop */ }
  }

  /* ---------- Copia de seguridad de los dos espacios ---------- */
  function exportAll() {
    save();
    var out = { formato: 'mis-cuentas', version: 1, exportado: new Date().toISOString(), espacios: {} };
    Object.keys(SPACES).forEach(function (k) {
      try {
        var raw = localStorage.getItem(SPACES[k].key);
        if (raw) out.espacios[k] = JSON.parse(raw);
      } catch (e) { /* noop */ }
    });
    return out;
  }
  /** Acepta la copia nueva (dos espacios) y la antigua (solo Casa). */
  function importAll(data) {
    var esp = {};
    if (data && data.espacios) esp = data.espacios;
    else if (data && Array.isArray(data.movements)) esp = { casa: data };
    else throw new Error('formato');
    Object.keys(esp).forEach(function (k) {
      if (SPACES[k] && esp[k] && Array.isArray(esp[k].movements)) {
        localStorage.setItem(SPACES[k].key, JSON.stringify(esp[k]));
      }
    });
    load();
    return Object.keys(esp).filter(function (k) { return SPACES[k]; });
  }
  function describeBackup(data) {
    var esp = data && data.espacios ? data.espacios : (data && Array.isArray(data.movements) ? { casa: data } : {});
    return Object.keys(esp).filter(function (k) { return SPACES[k]; }).map(function (k) {
      return SPACES[k].label + ': ' + ((esp[k].movements || []).length) + ' movimientos';
    }).join(' · ');
  }

  /* ---------- Formato ---------- */
  /* useGrouping:'always' fuerza el punto de los miles. Sin él, el español
     escribe "7919,65" (solo agrupa a partir de 5 cifras) y en dinero se lee mal. */
  function fmt(op) {
    try { return new Intl.NumberFormat('es-ES', Object.assign({ useGrouping: 'always' }, op)); }
    catch (e) { return new Intl.NumberFormat('es-ES', op); }
  }
  var nfEur = fmt({ style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  var nfEur0 = fmt({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var nfNum = fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function eur(n) { return nfEur.format(n || 0); }
  function eur0(n) { return nfEur0.format(n || 0); }
  function num(n) { return nfNum.format(n || 0); }
  function pct(n) { return (n * 100).toFixed(1).replace('.', ',') + ' %'; }
  function round2(n) { return Math.round(n * 100) / 100; }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function monthKey(iso) { return iso ? iso.slice(0, 7) : ''; }
  function monthLabel(key) {
    if (!key) return '';
    var p = key.split('-');
    return MESES_C[+p[1] - 1] + ' ' + p[0];
  }
  function monthLabelLong(key) {
    var p = key.split('-');
    return MESES[+p[1] - 1] + ' ' + p[0];
  }
  function addMonths(key, delta) {
    var p = key.split('-'), d = new Date(+p[0], +p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function monthBounds(key) {
    var p = key.split('-'), y = +p[0], m = +p[1];
    var last = new Date(y, m, 0).getDate();
    return { from: key + '-01', to: key + '-' + String(last).padStart(2, '0') };
  }
  function dayDiff(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 86400000); }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  /* ---------- Cuentas ---------- */
  function account(k) { return state.accounts[k] || null; }
  function accountLabel(k) { var a = account(k); return a ? a.label : k; }
  /** ¿Cuenta de dinero que entra y sale? Las de inversión no cuentan como gasto. */
  function isFlowAccount(k) { var a = account(k); return !a || a.kind !== 'inversion'; }
  /** Cuentas que aceptan el extracto de un banco (p. ej. las dos de ING). */
  function accountsForBank(bank) {
    return Object.keys(state.accounts).filter(function (k) {
      var a = state.accounts[k];
      return a.importable !== false && (a.bank ? a.bank === bank : k === bank);
    });
  }
  /** ¿Son la misma cuenta, o dos cuentas del mismo banco? (para emparejar traspasos) */
  function sameAccountOrBank(a, b) {
    if (a === b) return true;
    var x = account(a), y = account(b);
    return !!(x && y && x.bank && x.bank === y.bank);
  }

  /* ---------- Categorías ---------- */
  function getCategory(name) {
    if (!name) return null;
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].name === name) return state.categories[i];
    }
    return null;
  }
  function categoryType(name) {
    var c = getCategory(name);
    return c ? c.type : null;
  }
  function categoryColor(name) {
    var c = getCategory(name);
    return c ? 'var(' + c.color + ')' : 'var(--muted)';
  }

  /* ---------- Clasificación por reglas ---------- */
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** -> { category, counterpart } . source = cuenta del movimiento (opcional). */
  function matchRuleFull(text, amount, source) {
    var hay = normalize(text);
    var rules = state.rules.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.enabled === false || !r.pattern) continue;
      // una regla de traspaso hacia X no vale para los movimientos de la propia X
      if (r.counterpart && source && r.counterpart === source) continue;
      var parts = String(r.pattern).split('|');
      for (var j = 0; j < parts.length; j++) {
        var p = normalize(parts[j]);
        if (p && hay.indexOf(p) !== -1) {
          return { category: r.category, counterpart: (r.counterpart && state.accounts[r.counterpart]) ? r.counterpart : null };
        }
      }
    }
    // Sin regla: por signo
    return { category: amount >= 0 ? 'Otros ingresos' : 'Otros gastos', counterpart: null };
  }
  function matchRule(text, amount, source) { return matchRuleFull(text, amount, source).category; }

  /** Pone categoría y cuenta de enfrente a un movimiento según las reglas. */
  function classify(m) {
    var r = matchRuleFull(m.concept + ' ' + (m.extra || ''), m.amount, m.source);
    m.category = r.category;
    if (r.counterpart) m.counterpart = r.counterpart;
    else if (!m.pairId) delete m.counterpart;
    return m;
  }

  /** Reaplica reglas. force=true pisa también las categorías puestas a mano.
      Los traspasos ya emparejados no se tocan: su categoría la da la pareja. */
  function reapplyRules(force) {
    var n = 0;
    state.movements.forEach(function (m) {
      if (m.pairId || m.auto) return;
      if (m.manual && !force) return;
      var antes = m.category + '|' + (m.counterpart || '');
      classify(m);
      if (force) m.manual = false;
      if (antes !== m.category + '|' + (m.counterpart || '')) n++;
    });
    if (space === 'personal') pairTransfers();
    save();
    return n;
  }

  /* ---------- Huella para detectar duplicados ---------- */
  function fingerprint(m) {
    return [m.source, m.date, (Math.round(m.amount * 100) / 100).toFixed(2), normalize(m.concept).slice(0, 60)].join('|');
  }

  /* ============================================================
     TRASPASOS ENTRE TUS CUENTAS
     ============================================================ */
  var PISTA_TRASPASO = /(transferencia|traspaso|top-?up|recarga|reintegro|cajero|retirada|revolut|degiro|bingx|mexc|binance|coinbase|bit2me|kraken|exchange|cash withdrawal)/;

  function pareceTraspaso(m) {
    return !!m.counterpart || categoryType(m.category) === 'traspaso' ||
      PISTA_TRASPASO.test(normalize(m.concept + ' ' + (m.extra || '')));
  }

  function byId(id) {
    for (var i = 0; i < state.movements.length; i++) if (state.movements[i].id === id) return state.movements[i];
    return null;
  }

  /** Categoría de un traspaso: "Inversión" si una de las dos puntas lo es. */
  function transferCategory(m) {
    var a = account(m.source), b = account(m.counterpart);
    var inv = (a && a.kind === 'inversion') || (b && b.kind === 'inversion');
    if (inv && getCategory('Inversión')) return 'Inversión';
    return getCategory('Traspaso entre cuentas') ? 'Traspaso entre cuentas' : m.category;
  }

  function link(a, b) {
    a.pairId = b.id; b.pairId = a.id;
    a.counterpart = b.source; b.counterpart = a.source;
    [a, b].forEach(function (m) {
      if (m.manual) return;
      if (categoryType(m.category) !== 'traspaso') m.category = transferCategory(m);
    });
  }

  /* 1) Empareja: el mismo importe sale de una cuenta tuya y entra en otra en
        3 días o menos, y al menos una de las dos puntas parece un traspaso.
     2) Espejo: si la cuenta de enfrente no tiene extracto (efectivo, Degiro,
        cripto), se crea sola la otra punta. Así un reintegro de ING suma al
        efectivo y una compra en Degiro suma a lo aportado. */
  function pairTransfers() {
    var res = { paired: 0, mirrored: 0 };
    var libres = state.movements.filter(function (m) {
      return !m.pairId && !m.noPair && !m.excluded && m.amount !== 0;
    });
    var negs = libres.filter(function (m) { return m.amount < 0; }).sort(byDate);
    var poss = libres.filter(function (m) { return m.amount > 0; });

    negs.forEach(function (n) {
      var best = null, bestD = 99;
      poss.forEach(function (p) {
        if (p.pairId || p.source === n.source) return;
        if (Math.abs(p.amount + n.amount) > 0.005) return;
        var d = Math.abs(dayDiff(p.date, n.date));
        if (d > 3) return;
        if (!pareceTraspaso(n) && !pareceTraspaso(p)) return;
        // si una punta ya dice a qué cuenta va, la otra tiene que ser esa (o del mismo banco:
        // una recarga de Revolut "desde ING" puede salir de ING Nómina o de ING Ahorro)
        if (n.counterpart && !sameAccountOrBank(n.counterpart, p.source)) return;
        if (p.counterpart && !sameAccountOrBank(p.counterpart, n.source)) return;
        if (d < bestD) { bestD = d; best = p; }
      });
      if (best) { link(n, best); res.paired++; }
    });

    state.movements.slice().forEach(function (m) {
      if (m.pairId || m.auto || m.noPair || m.excluded || !m.counterpart) return;
      var dest = account(m.counterpart);
      if (!dest || dest.importable || m.counterpart === m.source) return;
      var espejo = {
        id: uid(), source: m.counterpart, date: m.date, valueDate: null,
        concept: (m.amount < 0 ? 'Desde ' : 'Hacia ') + accountLabel(m.source) + ' · ' + m.concept,
        extra: '', amount: round2(-m.amount), balance: null, category: null,
        manual: false, note: '', excluded: false, importedAt: new Date().toISOString(), auto: true
      };
      espejo.fp = fingerprint(espejo);
      state.movements.push(espejo);
      link(m, espejo);
      if (categoryType(espejo.category) !== 'traspaso' || !espejo.category) espejo.category = transferCategory(espejo);
      res.mirrored++;
    });
    return res;
  }

  /** Deshace un emparejamiento y evita que se vuelva a emparejar solo. */
  function unpair(id) {
    var m = byId(id);
    if (!m || !m.pairId) return;
    var p = byId(m.pairId);
    if (p && p.auto) removeMovements([p.id]);
    else if (p) soltar(p);
    soltar(m);
  }
  /* Si dices que no es un traspaso, pasa a contar como gasto o ingreso aunque
     su concepto diga "transferencia" (y queda fijado para que no vuelva solo). */
  function soltar(m) {
    delete m.pairId;
    m.noPair = true;
    if (!m.manual) classify(m);
    delete m.counterpart;
    if (categoryType(m.category) === 'traspaso') {
      m.category = m.amount < 0 ? 'Otros gastos' : 'Otros ingresos';
      m.manual = true;
    }
  }

  /** Borra movimientos; arrastra los espejos automáticos y suelta parejas. */
  function removeMovements(ids) {
    var fuera = {};
    ids.forEach(function (id) { fuera[id] = 1; });
    state.movements.forEach(function (m) {
      if (fuera[m.id] && m.pairId) {
        var p = byId(m.pairId);
        if (p && p.auto) fuera[p.id] = 1;
      }
    });
    state.movements = state.movements.filter(function (m) { return !fuera[m.id]; });
    var vivos = {};
    state.movements.forEach(function (m) { vivos[m.id] = 1; });
    state.movements.forEach(function (m) { if (m.pairId && !vivos[m.pairId]) delete m.pairId; });
  }

  /* ============================================================
     SALDOS, APORTADO Y PATRIMONIO
     ============================================================ */
  /* Con varios movimientos el mismo día, el saldo final es el que no sirve
     de saldo previo a ningún otro (no depende del orden del fichero). */
  function ultimoDelDia(lista) {
    for (var i = 0; i < lista.length; i++) {
      var m = lista[i], previo = false;
      for (var j = 0; j < lista.length && !previo; j++) {
        if (i !== j && Math.abs((lista[j].balance - lista[j].amount) - m.balance) < 0.005) previo = true;
      }
      if (!previo) return m;
    }
    return lista[lista.length - 1];
  }
  function primeroDelDia(lista) {
    for (var i = 0; i < lista.length; i++) {
      var m = lista[i], viene = false;
      for (var j = 0; j < lista.length && !viene; j++) {
        if (i !== j && Math.abs(lista[j].balance - (m.balance - m.amount)) < 0.005) viene = true;
      }
      if (!viene) return m;
    }
    return lista[0];
  }
  /** Saldo al cierre de cada día, para una lista con columna de saldo. */
  function dailyBalances(list) {
    var dias = {};
    list.forEach(function (m) { if (m.balance != null) (dias[m.date] = dias[m.date] || []).push(m); });
    return Object.keys(dias).sort().map(function (d) { return { date: d, balance: ultimoDelDia(dias[d]).balance }; });
  }

  /** Lo que has metido en una cuenta de inversión (menos lo que has sacado).
      Sale de los traspasos desde tus cuentas; si no hay ninguno (el historial
      de ING no llega tan atrás), de tus compras y ventas. */
  function invested(acc, until) {
    return investedInfo(acc, until).value;
  }
  function investedInfo(acc, until) {
    var a = account(acc) || {};
    if (useTrades(acc)) {
      var ops = tradesOf(acc).filter(function (t) { return !until || t.date <= until; });
      return { value: round2(ops.reduce(function (s, t) { return s + (t.side === 'buy' ? t.gross + t.fee : -(t.gross - t.fee)); }, 0)), from: 'operaciones' };
    }
    var hay = false;
    var porTraspasos = state.movements.reduce(function (s, m) {
      if (m.source !== acc || (until && m.date > until)) return s;
      if (categoryType(m.category) !== 'traspaso') return s;
      hay = true;
      return s + m.amount;
    }, 0);
    if (hay || a.openingInvested) return { value: round2((a.openingInvested || 0) + porTraspasos), from: 'traspasos' };
    return { value: 0, from: 'nada' };
  }

  /* ¿Lo aportado sale de las compras y ventas en vez de los traspasos?
     Sí cuando no hay traspasos, o cuando tus compras empiezan antes que el
     primer traspaso importado (el historial del banco no llega tan atrás) y
     no has puesto lo aportado antes de empezar. */
  function useTrades(acc) {
    var a = account(acc) || {};
    var ops = tradesOf(acc);
    if (!ops.length || a.openingInvested) return false;
    var primeraOp = ops.reduce(function (x, t) { return t.date < x ? t.date : x; }, ops[0].date);
    var traspasos = state.movements.filter(function (m) { return m.source === acc && !m.excluded && categoryType(m.category) === 'traspaso'; });
    if (!traspasos.length) return true;
    var primerT = traspasos.reduce(function (x, m) { return m.date < x ? m.date : x; }, traspasos[0].date);
    return primeraOp < primerT;
  }

  /** Saldo de una cuenta a una fecha (o hoy): { value, how, date, invested?, valued? } */
  function accountBalance(acc, until) {
    var a = account(acc);
    if (!a) return { value: 0, how: '', date: null };
    var todos = state.movements.filter(function (m) { return m.source === acc; });
    var hasta = todos.filter(function (m) { return !until || m.date <= until; });

    if (a.kind === 'inversion') {
      var ii = investedInfo(acc, until), inv = ii.value;
      var vals = (state.valuations || []).filter(function (v) { return v.account === acc && (!until || v.date <= until); }).sort(byDate);
      if (vals.length) {
        var v = vals[vals.length - 1];
        return { value: v.value, invested: inv, investedFrom: ii.from, how: 'valoración del ' + fmtDate(v.date), date: v.date, valued: true };
      }
      return { value: inv, invested: inv, investedFrom: ii.from, how: inv ? (ii.from === 'operaciones' ? 'coste de tus operaciones, aún sin valorar' : 'lo aportado, aún sin valorar') : 'sin datos todavía', date: null, valued: false };
    }

    var conSaldo = todos.filter(function (m) { return m.balance != null && !m.auto; });
    if (conSaldo.length) {
      var previos = conSaldo.filter(function (m) { return !until || m.date <= until; });
      if (!previos.length) {
        // antes del primer extracto: el saldo con el que arrancó
        var d0 = conSaldo.reduce(function (x, m) { return m.date < x ? m.date : x; }, conSaldo[0].date);
        var f = primeroDelDia(conSaldo.filter(function (m) { return m.date === d0; }));
        return { value: round2(f.balance - f.amount), how: 'saldo anterior al primer extracto', date: null };
      }
      var dU = previos.reduce(function (x, m) { return m.date > x ? m.date : x; }, previos[0].date);
      var u = ultimoDelDia(previos.filter(function (m) { return m.date === dU; }));
      var aMano = hasta.filter(function (m) { return m.balance == null && m.date > dU; })
        .reduce(function (s, m) { return s + m.amount; }, 0);
      return { value: round2(u.balance + aMano), how: 'saldo del extracto a ' + fmtDate(dU), date: dU };
    }

    var total = (a.opening || 0) + hasta.reduce(function (s, m) { return s + m.amount; }, 0);
    var ultima = hasta.reduce(function (x, m) { return !x || m.date > x ? m.date : x; }, null);
    return { value: round2(total), how: a.opening ? 'saldo inicial + lo apuntado' : 'suma de lo apuntado', date: ultima };
  }

  /** Cuentas que cuentan para el patrimonio (la tarjeta no tiene saldo propio). */
  function balanceAccounts() {
    return Object.keys(state.accounts).filter(function (k) { return !state.accounts[k].noBalance; });
  }

  function netWorth(until) {
    return round2(balanceAccounts().reduce(function (s, k) { return s + accountBalance(k, until).value; }, 0));
  }

  /** Dinero disponible: lo que hay en las cuentas de liquidez (sin inversiones). */
  function liquidity(until) {
    return round2(balanceAccounts().filter(function (k) { return state.accounts[k].kind !== 'inversion'; })
      .reduce(function (s, k) { return s + accountBalance(k, until).value; }, 0));
  }

  /* ============================================================
     GASTO FIJO Y VARIABLE
     ============================================================ */
  function isFixed(cat) { var c = getCategory(cat); return !!(c && c.fixed); }

  /** { fixed, variable, byCat:[{name,value}] } del gasto de una lista. */
  function fixedVariable(list) {
    var r = { fixed: 0, variable: 0, byCat: [] }, map = {};
    list.forEach(function (m) {
      if (!countsAsFlow(m) || m.amount >= 0) return;
      if (isFixed(m.category)) { r.fixed -= m.amount; map[m.category] = (map[m.category] || 0) - m.amount; }
      else r.variable -= m.amount;
    });
    r.fixed = round2(r.fixed); r.variable = round2(r.variable);
    r.byCat = Object.keys(map).map(function (k) { return { name: k, value: round2(map[k]) }; })
      .sort(function (a, b) { return b.value - a.value; });
    return r;
  }

  /** Gasto medio al mes de los últimos n meses COMPLETOS con datos
      (el mes en curso no cuenta: aún no ha terminado). */
  function monthlyAverage(n, fixedOnly) {
    var actual = monthKey(todayISO());
    var meses = byMonth(state.movements).map(function (m) { return m.key; })
      .filter(function (k) { return k < actual; }).slice(-(n || 3));
    if (!meses.length) return { value: 0, raw: 0, months: [] };
    var total = 0;
    meses.forEach(function (k) {
      var b = monthBounds(k);
      var lista = filterMovements({ from: b.from, to: b.to });
      if (fixedOnly) total += fixedVariable(lista).fixed;
      else total += totals(lista).expense;
    });
    // raw: sin redondear, para que "te faltan" no arrastre céntimos de redondeo
    return { value: round2(total / meses.length), raw: total / meses.length, months: meses };
  }

  /** Colchón: cuántos meses de gasto cubre el dinero disponible. */
  function cushion() {
    var disp = liquidity();
    var med = monthlyAverage(3), fij = monthlyAverage(3, true);
    var meta = +(state.settings && state.settings.cushionMonths) || 6;
    return {
      available: disp, avg: med.value, avgFixed: fij.value, months: med.months, goal: meta,
      covered: med.raw > 0 ? disp / med.raw : null,
      coveredFixed: fij.raw > 0 ? disp / fij.raw : null,
      target: round2(meta * med.raw),
      gap: round2(meta * med.raw - disp)
    };
  }

  /* ============================================================
     CARGOS RECURRENTES (suscripciones y recibos)
     El mismo comercio cobrando cada mes (o cada trimestre, o cada año).
     ============================================================ */
  function addMonthsToDate(iso, n) {
    var p = iso.split('-'), y = +p[0], m = +p[1] - 1 + n, d = +p[2];
    var ultimo = new Date(y, m + 1, 0).getDate();
    var f = new Date(y, m, Math.min(d, ultimo));
    return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
  }
  function mediana(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; }), h = Math.floor(a.length / 2);
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  }
  function recurringKey(m) { return m.source + '|' + merchantOf(m.concept); }

  function detectRecurring() {
    var ignorar = state.recurringIgnored || [];
    var grupos = {}, horizonte = {};
    state.movements.forEach(function (m) {
      if (!horizonte[m.source] || m.date > horizonte[m.source]) horizonte[m.source] = m.date;
      if (!countsAsFlow(m) || m.amount >= 0) return;
      var k = recurringKey(m);
      (grupos[k] = grupos[k] || []).push(m);
    });
    var out = [];
    Object.keys(grupos).forEach(function (k) {
      var ms = grupos[k].sort(byDate);
      var meses = {};
      ms.forEach(function (m) { meses[monthKey(m.date)] = 1; });
      var nMeses = Object.keys(meses).length;
      if (nMeses < 2) return;
      // varias veces al mes es una compra habitual (el súper), no una suscripción
      if (ms.length / nMeses > 1.34) return;
      var gaps = [];
      for (var i = 1; i < ms.length; i++) gaps.push(dayDiff(ms[i].date, ms[i - 1].date));
      var med = mediana(gaps), freq = null;
      if (med >= 25 && med <= 35) freq = 'mensual';
      else if (med >= 80 && med <= 100) freq = 'trimestral';
      else if (med >= 340 && med <= 390) freq = 'anual';
      if (!freq) return;
      var imp = ms.map(function (m) { return -m.amount; });
      var ultimo = imp[imp.length - 1];
      var fijo = imp.every(function (a) { return Math.abs(a - ultimo) <= Math.max(0.5, ultimo * 0.03); });
      // con solo dos cargos, exigimos el mismo importe (si no, puede ser casualidad)
      if (ms.length < 3 && !fijo) return;
      var media = imp.reduce(function (s, a) { return s + a; }, 0) / imp.length;
      var ref = fijo ? ultimo : media;
      var porAno = { mensual: 12, trimestral: 4, anual: 1 }[freq];
      var paso = { mensual: 1, trimestral: 3, anual: 12 }[freq];
      var last = ms[ms.length - 1];
      var finDatos = horizonte[last.source] || last.date;
      out.push({
        key: k, name: prettyMerchant(last.concept), source: last.source, category: last.category,
        freq: freq, amount: round2(ref), fixedAmount: fijo,
        perYear: round2(ref * porAno), perMonth: round2(ref * porAno / 12),
        count: ms.length, first: ms[0].date, last: last.date, next: addMonthsToDate(last.date, paso),
        // si en el último extracto ya tocaba otro cargo y no ha llegado, quizá la diste de baja
        active: dayDiff(finDatos, last.date) <= med + 10,
        ignored: ignorar.indexOf(k) !== -1,
        ids: ms.map(function (m) { return m.id; })
      });
    });
    return out.sort(function (a, b) { return b.perYear - a.perYear; });
  }

  /* ============================================================
     DIVIDENDOS Y COMISIONES DE UNA INVERSIÓN (estado de cuenta de Degiro)
     ============================================================ */
  function investmentIncome(acc) {
    var r = { dividends: 0, taxes: 0, fees: 0, interest: 0, tradeFees: 0, other: [] };
    // la comisión de cada compra o venta también viene en el estado de cuenta:
    // si ya está en tus operaciones de ese día, no se cuenta dos veces
    var conComision = {};
    tradesOf(acc).forEach(function (t) { if (t.fee) { conComision[t.date] = 1; r.tradeFees -= t.fee; } });
    state.movements.forEach(function (m) {
      if (m.source !== acc || !m.invKind) return;
      if (m.currency && m.currency !== 'EUR') { r.other.push(m); return; }
      if (m.invKind === 'dividendo') r.dividends += m.amount;
      else if (m.invKind === 'retencion') r.taxes += m.amount;
      else if (m.invKind === 'comision') {
        if (conComision[m.date] && /transacci|terceros|third party|transaction/.test(normalize(m.extra + ' ' + m.concept))) return;
        r.fees += m.amount;
      }
      else if (m.invKind === 'interes') r.interest += m.amount;
    });
    r.fees += r.tradeFees;
    r.dividends = round2(r.dividends); r.taxes = round2(r.taxes); r.fees = round2(r.fees); r.interest = round2(r.interest);
    r.tradeFees = round2(r.tradeFees);
    r.netDividends = round2(r.dividends + r.taxes);
    return r;
  }

  /* ============================================================
     COMPRAS Y VENTAS DE ACCIONES (tu Excel de Degiro)
     Las ventas se casan con las compras más antiguas (FIFO), que es como
     lo calcula Hacienda en la declaración de la renta.
     ============================================================ */
  function tradeKey(symbol) { return normalize(symbol).toUpperCase(); }
  function tradeFingerprint(t) {
    return [t.account, t.date, t.side, t.key, (+t.qty).toFixed(6), (+t.gross).toFixed(2)].join('|');
  }
  function tradesOf(acc) {
    return (state.trades || []).filter(function (t) { return t.account === acc; });
  }

  /** Prepara las filas leídas: { news, dups }. Repetir el mismo fichero no duplica. */
  function analyzeTrades(acc, rows) {
    var existe = {};
    tradesOf(acc).forEach(function (t) { existe[t.fp] = (existe[t.fp] || 0) + 1; });
    var visto = {}, news = [], dups = [];
    rows.forEach(function (x) {
      var t = Object.assign({ id: uid(), account: acc, key: tradeKey(x.symbol) }, x);
      t.fp = tradeFingerprint(t);
      visto[t.fp] = (visto[t.fp] || 0) + 1;
      // dos compras iguales el mismo día en el fichero son dos compras: se cuentan, no se descartan
      if ((existe[t.fp] || 0) >= visto[t.fp]) dups.push(t); else news.push(t);
    });
    return { news: news, dups: dups };
  }

  function portfolio(acc) {
    var ops = tradesOf(acc).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1);
    });
    var pos = {}, porAno = {};
    var res = { positions: [], closed: [], realized: 0, fees: 0, cost: 0, trades: ops.length, byYear: [], incomplete: [] };
    ops.forEach(function (t) {
      var p = pos[t.key] || (pos[t.key] = { key: t.key, symbol: t.symbol, lots: [], realized: 0, fees: 0, buys: 0, sells: 0, first: t.date, last: t.date, currency: t.currency || null, short: false });
      p.last = t.date; p.fees += t.fee; res.fees += t.fee;
      if (t.side === 'buy') {
        // la comisión de compra es parte de lo que te costaron (como en la renta)
        p.lots.push({ qty: t.qty, unit: (t.gross + t.fee) / t.qty });
        p.buys++;
        return;
      }
      p.sells++;
      var quedan = t.qty, base = 0;
      while (quedan > 1e-9 && p.lots.length) {
        var l = p.lots[0], toma = Math.min(l.qty, quedan);
        base += toma * l.unit; l.qty -= toma; quedan -= toma;
        if (l.qty <= 1e-9) p.lots.shift();
      }
      if (quedan > 1e-6) p.short = true;   // vendes más de lo que consta comprado
      var casadas = t.qty - quedan;
      var g = (t.gross - t.fee) * (casadas / t.qty) - base;
      p.realized += g; res.realized += g;
      var y = t.date.slice(0, 4);
      porAno[y] = (porAno[y] || 0) + g;
    });
    Object.keys(pos).forEach(function (k) {
      var p = pos[k];
      p.qty = p.lots.reduce(function (s, l) { return s + l.qty; }, 0);
      p.cost = round2(p.lots.reduce(function (s, l) { return s + l.qty * l.unit; }, 0));
      p.avg = p.qty > 1e-9 ? p.cost / p.qty : 0;
      p.realized = round2(p.realized); p.fees = round2(p.fees);
      delete p.lots;
      if (p.short) res.incomplete.push(p.symbol);
      if (p.qty > 1e-6) { res.positions.push(p); res.cost += p.cost; } else res.closed.push(p);
    });
    res.positions.sort(function (a, b) { return b.cost - a.cost; });
    res.closed.sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    res.cost = round2(res.cost); res.realized = round2(res.realized); res.fees = round2(res.fees);
    res.byYear = Object.keys(porAno).sort().map(function (y) { return { year: y, value: round2(porAno[y]) }; });
    return res;
  }

  /* ============================================================
     RENTABILIDAD ANUAL (TIR, la "XIRR" de Excel)
     Tiene en cuenta CUÁNDO metiste cada euro: 1.000 € que llevan dos años
     dentro no pesan lo mismo que 1.000 € que metiste el mes pasado.
     ============================================================ */
  /** flujos: [{date, amount}] (− lo que pones, + lo que recibes) -> tasa anual o null */
  function xirr(flujos) {
    if (flujos.length < 2) return null;
    if (!flujos.some(function (f) { return f.amount < 0; }) || !flujos.some(function (f) { return f.amount > 0; })) return null;
    var t0 = flujos.reduce(function (x, f) { return f.date < x ? f.date : x; }, flujos[0].date);
    var ts = flujos.map(function (f) { return dayDiff(f.date, t0) / 365; });
    function van(r) {
      var s = 0;
      for (var i = 0; i < flujos.length; i++) s += flujos[i].amount / Math.pow(1 + r, ts[i]);
      return s;
    }
    // bisección: más lenta que Newton, pero nunca se pierde
    var lo = -0.9999, hi = 1, flo = van(lo), fhi = van(hi);
    while (flo * fhi > 0 && hi < 1e4) { hi *= 2; fhi = van(hi); }
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (var k = 0; k < 200; k++) {
      var mid = (lo + hi) / 2, fm = van(mid);
      if (Math.abs(fm) < 1e-9 || hi - lo < 1e-10) { lo = hi = mid; break; }
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /** Flujos de una cuenta de inversión hasta su última valoración. */
  function returnFlows(acc) {
    var a = account(acc);
    if (!a || a.kind !== 'inversion') return { reason: 'no-inversion' };
    var vals = (state.valuations || []).filter(function (v) { return v.account === acc; }).sort(byDate);
    if (!vals.length) return { reason: 'sin-valor' };
    var v = vals[vals.length - 1];
    var flujos = [], base = 'aportaciones', inicioSupuesto = false;
    var aport = state.movements.filter(function (m) {
      return m.source === acc && !m.excluded && categoryType(m.category) === 'traspaso' && m.date <= v.date;
    });
    if (!useTrades(acc) && (aport.length || a.openingInvested)) {
      aport.forEach(function (m) { flujos.push({ date: m.date, amount: -m.amount }); });
      if (a.openingInvested) {
        var d0 = a.openingInvestedDate;
        if (!d0) {
          // sin fecha: el primer dato que haya de esta cuenta
          inicioSupuesto = true;
          d0 = [vals[0].date].concat(aport.map(function (m) { return m.date; }), tradesOf(acc).map(function (t) { return t.date; }))
            .reduce(function (x, d) { return d < x ? d : x; });
        }
        flujos.push({ date: d0, amount: -a.openingInvested });
      }
    } else {
      var ops = tradesOf(acc).filter(function (t) { return t.date <= v.date; });
      if (!ops.length) return { reason: 'sin-aportaciones' };
      base = 'operaciones';
      ops.forEach(function (t) { flujos.push({ date: t.date, amount: t.side === 'buy' ? -(t.gross + t.fee) : t.gross - t.fee }); });
    }
    flujos = flujos.filter(function (f) { return f.date <= v.date && f.amount; });
    if (!flujos.length) return { reason: 'sin-aportaciones' };
    return { flows: flujos, valuation: v, basis: base, guessedStart: inicioSupuesto };
  }

  /** Rentabilidad de una cuenta o de varias juntas (cada una con su valoración). */
  function annualReturn(accs) {
    var lista = Array.isArray(accs) ? accs : [accs];
    var flujos = [], fin = null, base = {}, supuesto = false, valor = 0, usadas = [], motivo = null;
    lista.forEach(function (k) {
      var f = returnFlows(k);
      if (f.reason) { motivo = motivo || f.reason; return; }
      usadas.push(k);
      flujos = flujos.concat(f.flows);
      flujos.push({ date: f.valuation.date, amount: f.valuation.value, end: true });
      if (!fin || f.valuation.date > fin) fin = f.valuation.date;
      base[f.basis] = 1; supuesto = supuesto || f.guessedStart; valor += f.valuation.value;
    });
    if (!usadas.length) return { reason: motivo || 'sin-datos' };
    var inicio = flujos.filter(function (f) { return !f.end; }).reduce(function (x, f) { return !x || f.date < x ? f.date : x; }, null);
    var dias = dayDiff(fin, inicio);
    if (dias < 1) return { reason: 'mismo-dia', accounts: usadas };
    var r = xirr(flujos);
    if (r === null) return { reason: 'no-calculable', accounts: usadas };
    var puesto = 0, sacado = 0;
    flujos.forEach(function (f) { if (f.end) return; if (f.amount < 0) puesto -= f.amount; else sacado += f.amount; });
    return {
      rate: r, period: Math.pow(1 + r, dias / 365) - 1, days: dias, from: inicio, to: fin,
      basis: Object.keys(base), guessedStart: supuesto, accounts: usadas,
      put: round2(puesto), taken: round2(sacado), value: round2(valor),
      // con menos de medio año, anualizar exagera: +3 % en dos meses no es un +19 % al año
      confidence: dias >= 365 ? 'alta' : dias >= 182 ? 'media' : 'baja'
    };
  }

  /* ============================================================
     RECORDATORIO DE IMPORTAR
     Cada cuenta, hasta qué fecha tiene datos y si ya toca ponerla al día.
     ============================================================ */
  function importReminders(hoy) {
    hoy = hoy || todayISO();
    var limite = +(state.settings && state.settings.remindDays) || 35;
    var usada = state.movements.length > 0 || (state.valuations || []).length > 0;
    if (!usada) return [];
    var out = [];
    Object.keys(state.accounts).forEach(function (k) {
      var a = state.accounts[k];
      var suyos = state.movements.filter(function (m) { return m.source === k; });
      var maxFecha = function (l) { return l.reduce(function (x, m) { return !x || m.date > x ? m.date : x; }, null); };
      var it = { acc: k, label: a.label, muted: !!a.noRemind, pending: 0 };
      if (a.kind === 'inversion') {
        var vals = (state.valuations || []).filter(function (v) { return v.account === k; });
        if (!vals.length && !suyos.length && !tradesOf(k).length) return;   // no la usas
        it.kind = 'valor';
        it.last = maxFecha(vals);
      } else if (a.importable !== false) {
        it.kind = 'extracto';
        // lo que trae el extracto; lo creado solo o apuntado a mano no cuenta
        it.last = maxFecha(suyos.filter(function (m) { return !m.auto && !m.handEntered; }));
      } else {
        if (!suyos.length) return;
        it.kind = 'apuntes';
        it.last = maxFecha(suyos.filter(function (m) { return !m.auto; }));
        // lo que has sacado del cajero después de tu último apunte, sin decir en qué
        var sacado = suyos.filter(function (m) { return m.auto && m.amount > 0 && (!it.last || m.date > it.last); });
        it.pending = round2(sacado.reduce(function (s, m) { return s + m.amount; }, 0));
        it.pendingSince = maxFecha(sacado);
      }
      it.days = it.last ? dayDiff(hoy, it.last) : null;
      it.due = it.days === null || it.days > limite ||
        (it.kind === 'apuntes' && it.pending > 0 && dayDiff(hoy, it.pendingSince) > 7);
      out.push(it);
    });
    return out;
  }

  /* ============================================================
     VER OTRO ESPACIO SIN CAMBIAR DE ESPACIO (para la vista global)
     ============================================================ */
  function peekSpace(sp, fn) {
    if (sp === space) return fn();
    var antes = state, antesSp = space;
    space = sp;
    try { load(); return fn(); }
    finally { state = antes; space = antesSp; }
  }

  /** Patrimonio al cierre de cada mes, de los últimos n meses con datos. */
  function netWorthSeries(n) {
    var meses = monthsAvailable().concat((state.valuations || []).map(function (v) { return monthKey(v.date); })).sort();
    if (!meses.length) return [];
    var hoy = todayISO(), ini = meses[0], fin = monthKey(hoy);
    if (meses[meses.length - 1] > fin) fin = meses[meses.length - 1];
    var keys = [];
    for (var k = ini; k <= fin; k = addMonths(k, 1)) keys.push(k);
    return keys.slice(-(n || 12)).map(function (k) {
      var to = monthBounds(k).to;
      if (to > hoy) to = hoy;
      return { key: k, value: netWorth(to) };
    });
  }

  /* ---------- Consultas ---------- */
  function filterMovements(f) {
    f = f || {};
    var q = f.q ? normalize(f.q) : null;
    return state.movements.filter(function (m) {
      if (f.source && m.source !== f.source) return false;
      if (f.from && m.date < f.from) return false;
      if (f.to && m.date > f.to) return false;
      if (f.category && m.category !== f.category) return false;
      if (f.type) {
        var t = categoryType(m.category);
        if (f.type === 'gasto' && !(m.amount < 0 && t !== 'traspaso')) return false;
        if (f.type === 'ingreso' && !(m.amount > 0 && t !== 'traspaso')) return false;
        if (f.type === 'traspaso' && t !== 'traspaso') return false;
      }
      if (f.min != null && m.amount < f.min) return false;
      if (f.max != null && m.amount > f.max) return false;
      if (f.onlyIncluded && m.excluded) return false;
      if (q && normalize(m.concept + ' ' + (m.extra || '') + ' ' + (m.note || '') + ' ' + m.category).indexOf(q) === -1) return false;
      return true;
    });
  }

  /** ¿Cuenta este movimiento como ingreso o gasto? */
  function countsAsFlow(m) {
    return !m.excluded && isFlowAccount(m.source) && categoryType(m.category) !== 'traspaso';
  }

  /** Totales de un conjunto de movimientos, ignorando traspasos, excluidos
      y lo que pasa dentro de las cuentas de inversión. */
  function totals(list) {
    var t = { income: 0, expense: 0, transfers: 0, invested: 0, count: list.length };
    list.forEach(function (m) {
      if (m.excluded || !isFlowAccount(m.source)) return;
      var type = categoryType(m.category);
      if (type === 'traspaso') {
        t.transfers += Math.abs(m.amount);
        var dest = account(m.counterpart);
        if (dest && dest.kind === 'inversion') t.invested -= m.amount;
        return;
      }
      if (m.amount >= 0) t.income += m.amount; else t.expense += -m.amount;
    });
    t.net = t.income - t.expense;
    t.rate = t.income > 0 ? t.net / t.income : 0;
    t.invested = round2(t.invested);
    return t;
  }

  /** Agrupa por categoría los gastos (positivo = importe gastado). */
  function byCategory(list, kind) {
    var map = {};
    list.forEach(function (m) {
      if (!countsAsFlow(m)) return;
      var isExpense = m.amount < 0;
      if (kind === 'gasto' && !isExpense) return;
      if (kind === 'ingreso' && isExpense) return;
      var k = m.category || 'Sin categoría';
      map[k] = (map[k] || 0) + Math.abs(m.amount);
    });
    return Object.keys(map).map(function (k) { return { name: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /** Serie mensual: [{key, income, expense, net}] ordenada. */
  function byMonth(list) {
    var map = {};
    list.forEach(function (m) {
      if (!countsAsFlow(m)) return;
      var k = monthKey(m.date);
      if (!map[k]) map[k] = { key: k, income: 0, expense: 0 };
      if (m.amount >= 0) map[k].income += m.amount; else map[k].expense += -m.amount;
    });
    return Object.keys(map).sort().map(function (k) {
      map[k].net = map[k].income - map[k].expense;
      return map[k];
    });
  }

  /** Comercios más frecuentes a partir del concepto normalizado. */
  function byMerchant(list, limit) {
    var map = {};
    list.forEach(function (m) {
      if (!countsAsFlow(m) || m.amount >= 0) return;
      var k = merchantOf(m.concept);
      if (!map[k]) map[k] = { name: k, value: 0, count: 0 };
      map[k].value += -m.amount;
      map[k].count++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, limit || 8);
  }

  function merchantOf(concept) {
    var s = String(concept || '')
      .replace(/^(compra en|pago en|pago con tarjeta en|recibo de|recibo|transferencia de|transferencia a|bizum de|bizum a|adeudo de|adeudo)\s*/i, '')
      .replace(/\b\d{2}[\/-]\d{2}([\/-]\d{2,4})?\b/g, '')
      .replace(/\b\d{4,}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var words = s.split(' ').slice(0, 3).join(' ');
    return (words || s || 'Sin concepto').toUpperCase();
  }

  /** Nombre legible de un comercio: "COMPRA EN SPOTIFY AB" -> "Spotify",
      "RECIBO UNIVERSIDAD EUROPEA DE MADRID" -> "Universidad Europea de Madrid". */
  var MENORES = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a'];
  function prettyMerchant(concept) {
    var s = String(concept || '')
      .replace(/^(compra en|pago en|pago con tarjeta en|recibo de|recibo|transferencia de|transferencia a|bizum de|bizum a|adeudo de|adeudo)\s*/i, '')
      .replace(/\b\d{2}[\/-]\d{2}([\/-]\d{2,4})?\b/g, '')
      .replace(/\b\d{3,}\b/g, '')
      .replace(/\b(s\.?a\.?u?\.?|s\.?l\.?u?\.?|ab|b\.?v\.?|uab|sarl|ltd|inc|gmbh|espana|españa|spain)(?=\s|$)/gi, '')
      .replace(/\s+/g, ' ').trim();
    var w = s.split(' ').filter(Boolean).slice(0, 4);
    while (w.length > 1 && MENORES.indexOf(w[w.length - 1].toLowerCase()) !== -1) w.pop();
    if (!w.length) return merchantOf(concept);
    return w.map(function (p, i) {
      var l = p.toLowerCase();
      if (i > 0 && MENORES.indexOf(l) !== -1) return l;
      return l.charAt(0).toUpperCase() + l.slice(1);
    }).join(' ');
  }

  function rangeOfData(source) {
    var list = source ? state.movements.filter(function (m) { return m.source === source; }) : state.movements;
    if (!list.length) return null;
    var min = list[0].date, max = list[0].date;
    list.forEach(function (m) { if (m.date < min) min = m.date; if (m.date > max) max = m.date; });
    return { from: min, to: max };
  }

  /** Meses con ingresos o gastos de verdad (sin los apuntes dentro de Degiro o cripto). */
  function flowMonths() {
    var set = {};
    state.movements.forEach(function (m) { if (countsAsFlow(m)) set[monthKey(m.date)] = 1; });
    return Object.keys(set).sort();
  }

  function monthsAvailable(source) {
    var set = {};
    state.movements.forEach(function (m) {
      if (source && m.source !== source) return;
      set[monthKey(m.date)] = 1;
    });
    return Object.keys(set).sort();
  }

  global.Store = {
    get KEY() { return SPACES[space].key; },
    SPACES: SPACES,
    get space() { return space; },
    setSpace: setSpace,
    SERIES: SERIES,
    load: load,
    save: save,
    uid: uid,
    get state() { return state; },
    set state(v) { state = v; },
    defaultState: defaultState,
    getTheme: getTheme, setTheme: setTheme,
    exportAll: exportAll, importAll: importAll, describeBackup: describeBackup,
    eur: eur, eur0: eur0, num: num, pct: pct, round2: round2,
    fmtDate: fmtDate, monthKey: monthKey, monthLabel: monthLabel, monthLabelLong: monthLabelLong,
    addMonths: addMonths, todayISO: todayISO, monthBounds: monthBounds, MESES_C: MESES_C, dayDiff: dayDiff,
    account: account, accountLabel: accountLabel, isFlowAccount: isFlowAccount,
    accountsForBank: accountsForBank, sameAccountOrBank: sameAccountOrBank, balanceAccounts: balanceAccounts,
    liquidity: liquidity, isFixed: isFixed, fixedVariable: fixedVariable, monthlyAverage: monthlyAverage, cushion: cushion,
    detectRecurring: detectRecurring, addMonthsToDate: addMonthsToDate, investmentIncome: investmentIncome, peekSpace: peekSpace,
    tradesOf: tradesOf, analyzeTrades: analyzeTrades, portfolio: portfolio, investedInfo: investedInfo,
    xirr: xirr, annualReturn: annualReturn, importReminders: importReminders,
    getCategory: getCategory, categoryType: categoryType, categoryColor: categoryColor,
    normalize: normalize, matchRule: matchRule, matchRuleFull: matchRuleFull, classify: classify, reapplyRules: reapplyRules,
    fingerprint: fingerprint, merchantOf: merchantOf, prettyMerchant: prettyMerchant,
    byId: byId, pairTransfers: pairTransfers, unpair: unpair, removeMovements: removeMovements,
    dailyBalances: dailyBalances, invested: invested, accountBalance: accountBalance,
    netWorth: netWorth, netWorthSeries: netWorthSeries,
    filterMovements: filterMovements, countsAsFlow: countsAsFlow, totals: totals, byCategory: byCategory,
    byMonth: byMonth, byMerchant: byMerchant, rangeOfData: rangeOfData, monthsAvailable: monthsAvailable, flowMonths: flowMonths
  };
})(window);
