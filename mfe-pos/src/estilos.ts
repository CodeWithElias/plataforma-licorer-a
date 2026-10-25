/**
 * Estilos del POS (identidad blanco y lila de la plataforma). Van en un <style> dentro del componente para que
 * funcionen igual como Web Component dentro del Shell y como PWA sola; por eso definen sus propias variables.
 */
export const estilos = `
.pos {
  --lila-50: #f7f4ff; --lila-100: #efe9ff; --lila-200: #ddd2fe; --lila-300: #c4b0fb;
  --lila-500: #8b5cf6; --lila-600: #7c3aed; --lila-700: #6a2fd0;
  --tinta: #241a38; --gris: #6c6880; --gris-claro: #9a96ab; --borde: #ebe7f4; --fondo: #faf9fd;
  --verde: #12805c; --verde-fondo: #e9f8f1; --rojo: #c0264b; --rojo-fondo: #fdecf0;
  --radio: 14px;
  --sombra: 0 1px 2px rgba(36,26,56,.04), 0 8px 24px -12px rgba(76,29,149,.18);
  --degradado: linear-gradient(135deg, var(--lila-500), var(--lila-700));
  display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1.5rem;
  max-width: 1440px; margin: 0 auto; padding: 1.75rem;
  font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; color: var(--tinta);
}
@media (max-width: 980px) { .pos { grid-template-columns: 1fr; } }
.pos button { font: inherit; }
.pos svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

/* Encabezado y búsqueda */
.pos-encabezado { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
.pos-encabezado h1 { margin: 0; font-size: 1.6rem; letter-spacing: -.02em; }
.pos-encabezado p { margin: .2rem 0 0; color: var(--gris); font-size: .92rem; }
.pos-buscar { display: flex; align-items: center; gap: .55rem; min-width: min(360px, 100%); padding: 0 .9rem; height: 44px;
  background: #fff; border: 1px solid var(--borde); border-radius: 12px; color: var(--gris-claro); transition: border-color .15s, box-shadow .15s; }
.pos-buscar:focus-within { border-color: var(--lila-300); box-shadow: 0 0 0 4px rgba(139,92,246,.12); }
.pos-buscar svg { width: 18px; height: 18px; flex: none; }
.pos-buscar input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; color: var(--tinta); }

/* Filtros */
.pos-chips { display: flex; gap: .45rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.pos-chips button { padding: .42rem .95rem; border: 1px solid var(--borde); border-radius: 999px; background: #fff; color: var(--gris);
  font-size: .88rem; font-weight: 550; cursor: pointer; transition: all .15s; }
.pos-chips button:hover { border-color: var(--lila-300); color: var(--lila-700); }
.pos-chips button.activo { background: var(--lila-600); border-color: var(--lila-600); color: #fff; }

/* Productos */
.pos-productos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .9rem; }
.pos-producto { position: relative; display: flex; flex-direction: column; gap: .3rem; min-height: 158px; padding: 1rem; text-align: left;
  background: #fff; border: 1px solid var(--borde); border-radius: var(--radio); box-shadow: var(--sombra); cursor: pointer;
  transition: transform .15s, border-color .15s, box-shadow .15s; }
.pos-producto:hover { transform: translateY(-2px); border-color: var(--lila-300); box-shadow: 0 14px 28px -14px rgba(124,58,237,.38); }
.pos-producto.seleccionado { border-color: var(--lila-500); box-shadow: 0 0 0 3px rgba(139,92,246,.15), var(--sombra); }
.pos-producto.esqueleto { cursor: default; background: linear-gradient(90deg, #fff 25%, var(--lila-50) 50%, #fff 75%); background-size: 200% 100%;
  animation: pos-brillo 1.2s infinite; }
@keyframes pos-brillo { from { background-position: 200% 0 } to { background-position: -200% 0 } }
.pos-insignia { align-self: flex-start; padding: .18rem .55rem; border-radius: 999px; font-size: .72rem; font-weight: 650;
  text-transform: uppercase; letter-spacing: .04em; background: var(--lila-100); color: var(--lila-700); }
.pos-insignia.t-cerveza { background: #fff6dc; color: #9a6a00; }
.pos-insignia.t-vino { background: #fbe9f0; color: #a3234f; }
.pos-insignia.t-singani { background: #e8f6f3; color: #11735f; }
.pos-insignia.t-whisky { background: #fdf0e3; color: #a2541b; }
.pos-insignia.t-vodka { background: #e9f1fd; color: #2f5fb0; }
.pos-insignia.t-ron { background: #f3ece4; color: #7a4b22; }
.pos-contador { position: absolute; top: .75rem; right: .75rem; display: grid; place-items: center; min-width: 24px; height: 24px; padding: 0 .4rem;
  border-radius: 999px; background: var(--degradado); color: #fff; font-size: .78rem; font-weight: 700; }
.pos-nombre { margin-top: .35rem; font-weight: 650; line-height: 1.3; }
.pos-detalle { color: var(--gris-claro); font-size: .8rem; }
.pos-pie { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: .5rem; }
.pos-precio { color: var(--lila-700); font-weight: 700; font-size: 1.05rem; }
.pos-agregar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: var(--lila-100); color: var(--lila-700);
  font-size: 1.2rem; font-weight: 600; transition: background .15s, color .15s; }
.pos-producto:hover .pos-agregar { background: var(--lila-600); color: #fff; }
.pos-vacio { grid-column: 1 / -1; color: var(--gris); text-align: center; padding: 2rem 0; }

/* Carrito */
.pos-carrito { position: sticky; top: 84px; align-self: start; display: flex; flex-direction: column; max-height: calc(100vh - 110px);
  background: #fff; border: 1px solid var(--borde); border-radius: 18px; box-shadow: 0 20px 48px -24px rgba(76,29,149,.35); overflow: hidden; }
.pos-carrito header { display: flex; align-items: center; justify-content: space-between; padding: 1.15rem 1.3rem; border-bottom: 1px solid var(--borde); }
.pos-carrito h2 { margin: 0; font-size: 1.1rem; }
.pos-unidades { padding: .2rem .6rem; border-radius: 999px; background: var(--lila-50); color: var(--lila-700); font-size: .8rem; font-weight: 600; }
.pos-carrito-vacio { display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: 2.5rem 1rem; color: var(--gris-claro); }
.pos-carrito-vacio svg { width: 40px; height: 40px; color: var(--lila-300); }
.pos-carrito-vacio p { margin: 0; font-size: .92rem; }
.pos-lineas { list-style: none; margin: 0; padding: .4rem 1.3rem; overflow-y: auto; }
.pos-lineas li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: .75rem; padding: .8rem 0; border-bottom: 1px dashed var(--borde); }
.pos-lineas li:last-child { border-bottom: 0; }
.pos-linea-info { display: flex; flex-direction: column; min-width: 0; }
.pos-linea-nombre { font-weight: 600; font-size: .92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pos-linea-precio { color: var(--gris-claro); font-size: .78rem; }
.pos-cantidad { display: flex; align-items: center; gap: .1rem; padding: .15rem; border: 1px solid var(--borde); border-radius: 10px; }
.pos-cantidad button { width: 26px; height: 26px; border: 0; border-radius: 8px; background: transparent; color: var(--lila-700); font-size: 1rem; cursor: pointer; }
.pos-cantidad button:hover { background: var(--lila-100); }
.pos-cantidad span { min-width: 22px; text-align: center; font-weight: 650; font-size: .9rem; }
.pos-linea-subtotal { min-width: 78px; text-align: right; font-weight: 650; font-size: .92rem; }

/* Resumen y cobro */
.pos-resumen { display: flex; flex-direction: column; gap: .9rem; padding: 1.2rem 1.3rem 1.3rem; border-top: 1px solid var(--borde); background: var(--lila-50); }
.pos-total { display: flex; align-items: baseline; justify-content: space-between; }
.pos-total span { color: var(--gris); font-weight: 550; }
.pos-total strong { font-size: 1.65rem; letter-spacing: -.02em; }
.pos-metodos { display: grid; grid-template-columns: repeat(3, 1fr); gap: .3rem; padding: .25rem; background: #fff; border: 1px solid var(--borde); border-radius: 12px; }
.pos-metodos button { padding: .5rem; border: 0; border-radius: 9px; background: transparent; color: var(--gris); font-weight: 600; font-size: .88rem; cursor: pointer; transition: all .15s; }
.pos-metodos button.activo { background: var(--lila-100); color: var(--lila-700); }
.pos-cobrar { height: 50px; border: 0; border-radius: 12px; background: var(--degradado); color: #fff; font-size: 1.02rem; font-weight: 650; cursor: pointer;
  box-shadow: 0 12px 24px -10px rgba(124,58,237,.6); transition: transform .12s, box-shadow .12s, opacity .12s; }
.pos-cobrar:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 16px 28px -10px rgba(124,58,237,.65); }
.pos-cobrar[disabled] { opacity: .45; cursor: default; box-shadow: none; }

/* Avisos */
.pos-alerta { display: flex; flex-direction: column; gap: .2rem; padding: .85rem 1rem; border-radius: 12px; font-size: .9rem; }
.pos-alerta strong { font-size: .95rem; }
.pos-alerta.ok { background: var(--verde-fondo); color: var(--verde); border: 1px solid #bfe9d6; }
.pos-alerta.error { background: var(--rojo-fondo); color: var(--rojo); border: 1px solid #f6c5d1; }
.pos-catalogo > .pos-alerta { margin-bottom: 1rem; }
`
