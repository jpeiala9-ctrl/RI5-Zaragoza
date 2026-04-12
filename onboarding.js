// ==================== onboarding.js - Tutorial interactivo post-registro ====================
// Versión: 1.0
// Se activa solo tras el registro. Nunca más después.
// Señala elementos reales de la app con spotlight + tooltip.
// ====================

const Onboarding = {

_paso: 0,
_overlay: null,
_tooltip: null,
_spotlight: null,

PASOS: [
{
tab: ‘entreno’,
selector: ‘#calcBtn’,
titulo: ‘1/5 · Calcula tus zonas’,
texto: ‘Introduce tu edad y tu tiempo en 6km. RI5 calcula tus 6 zonas de frecuencia cardíaca y tus ritmos objetivo al instante.’,
posicion: ‘bottom’
},
{
tab: ‘plan’,
selector: ‘#cuestionarioEntreno’,
titulo: ‘2/5 · Tu plan personalizado’,
texto: ‘Elige distancia objetivo, nivel y días disponibles. RI5 genera un plan de semanas con periodización real: base, construcción, pico y taper.’,
posicion: ‘top’
},
{
tab: ‘muro’,
selector: ‘#wallContainer’,
titulo: ‘3/5 · El muro de la comunidad’,
texto: ‘Aquí aparecen los entrenamientos de todos los usuarios. Cuando completes una sesión de tu plan, se publicará automáticamente.’,
posicion: ‘top’
},
{
tab: ‘amigos’,
selector: ‘#amigos-buscar’,
titulo: ‘4/5 · Conecta con corredores’,
texto: ‘Busca usuarios, envía solicitudes de amistad y chatea con ellos directamente. Cuantos más amigos, más activo el muro.’,
posicion: ‘top’
},
{
tab: ‘perfil’,
selector: ‘#perfilContainer’,
titulo: ‘5/5 · Completa tu perfil’,
texto: ‘¡Ya estás listo! Añade tu foto, ciudad y bio para que otros corredores te conozcan. Pulsa el lápiz para editar.’,
posicion: ‘top’,
esUltimo: true
}
],

// ─── Punto de entrada ────────────────────────────────────────────────────────
iniciar() {
// Solo si no se ha hecho antes
if (localStorage.getItem(‘ri5_onboarding_done’) === ‘true’) return;

```
this._paso = 0;
this._crearEstructura();

// Pequeño delay para que la app termine de renderizar
setTimeout(() => this._mostrarPaso(0), 600);
```

},

// ─── Crear overlay + spotlight + tooltip (una sola vez) ──────────────────────
_crearEstructura() {
// Limpiar anterior si existe
this._destruir();

```
// Overlay oscuro con hueco (clip-path dinámico)
this._overlay = document.createElement('div');
this._overlay.id = 'onboardingOverlay';
this._overlay.style.cssText = `
  position: fixed; inset: 0; z-index: 9000;
  pointer-events: none;
  transition: clip-path 0.4s ease;
`;

// Capa oscura real (detrás del spotlight)
this._dimmer = document.createElement('div');
this._dimmer.id = 'onboardingDimmer';
this._dimmer.style.cssText = `
  position: fixed; inset: 0; z-index: 8999;
  background: rgba(0,0,0,0.72);
  transition: opacity 0.3s;
`;

// Borde animado del spotlight
this._spotlight = document.createElement('div');
this._spotlight.id = 'onboardingSpotlight';
this._spotlight.style.cssText = `
  position: fixed; z-index: 9001; pointer-events: none;
  border: 2.5px solid var(--accent-yellow);
  border-radius: 12px;
  box-shadow: 0 0 0 4px rgba(255,200,0,0.18), 0 0 24px 4px rgba(255,200,0,0.13);
  transition: all 0.4s cubic-bezier(.4,0,.2,1);
`;

// Tooltip
this._tooltip = document.createElement('div');
this._tooltip.id = 'onboardingTooltip';
this._tooltip.style.cssText = `
  position: fixed; z-index: 9002;
  background: var(--bg-primary); border: 1px solid var(--border-color);
  border-radius: 20px; padding: 20px;
  width: min(88vw, 360px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
  transition: all 0.35s cubic-bezier(.4,0,.2,1);
`;

document.body.appendChild(this._dimmer);
document.body.appendChild(this._overlay);
document.body.appendChild(this._spotlight);
document.body.appendChild(this._tooltip);

// Click en dimmer → saltar tutorial
this._dimmer.style.pointerEvents = 'all';
this._dimmer.addEventListener('click', (e) => {
  // Solo si el click no fue dentro del tooltip
  if (!this._tooltip.contains(e.target)) {
    this._skip();
  }
});
```

},

// ─── Mostrar paso N ──────────────────────────────────────────────────────────
async _mostrarPaso(n) {
const paso = this.PASOS[n];
if (!paso) return;

```
// Cambiar de tab si hace falta
if (window.UI && UI.switchTab) {
  await UI.switchTab(paso.tab);
}

// Esperar a que el DOM renderice el contenido de la tab
await this._esperar(350);

const el = document.querySelector(paso.selector);
if (!el) {
  // Elemento no encontrado, avanzar igualmente
  this._siguiente();
  return;
}

// Hacer scroll al elemento
el.scrollIntoView({ behavior: 'smooth', block: 'center' });
await this._esperar(300);

const rect = el.getBoundingClientRect();
const padding = 10;

// Posicionar spotlight
this._spotlight.style.left   = `${rect.left - padding}px`;
this._spotlight.style.top    = `${rect.top - padding}px`;
this._spotlight.style.width  = `${rect.width + padding * 2}px`;
this._spotlight.style.height = `${rect.height + padding * 2}px`;

// Agujero en el dimmer usando clip-path con polygon
// Dejamos un hueco rectangular donde está el elemento
const vw = window.innerWidth;
const vh = window.innerHeight;
const x1 = rect.left - padding, y1 = rect.top - padding;
const x2 = rect.right + padding, y2 = rect.bottom + padding;

this._dimmer.style.clipPath = `polygon(
  0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px,
  0 ${y1}px, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px,
  ${x2}px ${y1}px, 0 ${y1}px
)`;

// Contenido del tooltip
const esUltimo = paso.esUltimo || n === this.PASOS.length - 1;
this._tooltip.innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
    <span style="font-size:12px; color:var(--accent-yellow); font-weight:700; letter-spacing:1px;">
      ${Utils.escapeHTML(paso.titulo)}
    </span>
    <button id="onboardingSkip" style="
      background:none; border:none; color:var(--text-secondary);
      font-size:12px; cursor:pointer; padding:2px 6px;
    ">saltar</button>
  </div>
  <p style="margin:0 0 18px; font-size:14px; line-height:1.55; color:var(--text-primary);">
    ${Utils.escapeHTML(paso.texto)}
  </p>
  <div style="display:flex; gap:10px; justify-content:flex-end;">
    ${n > 0 ? `<button id="onboardingBack" style="${this._btnSecundario()}">← Atrás</button>` : ''}
    <button id="onboardingNext" style="${this._btnPrincipal()}">
      ${esUltimo ? '¡Empezar! 🚀' : 'Siguiente →'}
    </button>
  </div>
  <div style="display:flex; gap:5px; justify-content:center; margin-top:14px;">
    ${this.PASOS.map((_, i) => `
      <div style="
        width:${i === n ? 18 : 6}px; height:6px; border-radius:3px;
        background:${i === n ? 'var(--accent-yellow)' : 'var(--border-color)'};
        transition: width 0.3s;
      "></div>
    `).join('')}
  </div>
`;

// Posicionar tooltip encima o debajo del elemento
this._posicionarTooltip(rect, paso.posicion);

// Eventos
document.getElementById('onboardingNext')?.addEventListener('click', () => {
  if (esUltimo) this._finalizar();
  else this._siguiente();
});
document.getElementById('onboardingBack')?.addEventListener('click', () => this._anterior());
document.getElementById('onboardingSkip')?.addEventListener('click', () => this._skip());
```

},

_posicionarTooltip(rect, posicion) {
const tooltipH = 200; // altura estimada
const margen = 20;
const vw = window.innerWidth;

```
// Centrado horizontal sobre el elemento, sin salirse de pantalla
let left = rect.left + rect.width / 2 - 180;
left = Math.max(margen, Math.min(left, vw - 360 - margen));

let top;
if (posicion === 'bottom') {
  top = rect.bottom + 16;
  // Si se sale por abajo, ponerlo encima
  if (top + tooltipH > window.innerHeight - margen) {
    top = rect.top - tooltipH - 16;
  }
} else {
  top = rect.top - tooltipH - 16;
  if (top < margen) {
    top = rect.bottom + 16;
  }
}

this._tooltip.style.left = `${left}px`;
this._tooltip.style.top  = `${Math.max(margen, top)}px`;
```

},

// ─── Navegación ──────────────────────────────────────────────────────────────
_siguiente() {
this._paso++;
if (this._paso >= this.PASOS.length) {
this._finalizar();
} else {
this._mostrarPaso(this._paso);
}
},

_anterior() {
if (this._paso > 0) {
this._paso–;
this._mostrarPaso(this._paso);
}
},

_skip() {
this._finalizar(false);
},

_finalizar(completado = true) {
localStorage.setItem(‘ri5_onboarding_done’, ‘true’);
this._destruir();
if (completado) {
// Dejar al usuario en la tab de entreno para empezar
if (window.UI) UI.switchTab(‘entreno’);
setTimeout(() => {
Utils.showToast(‘🎉 ¡Tutorial completado! Ya puedes empezar.’, ‘success’, 4000);
}, 300);
}
},

_destruir() {
[‘onboardingOverlay’, ‘onboardingDimmer’, ‘onboardingSpotlight’, ‘onboardingTooltip’]
.forEach(id => document.getElementById(id)?.remove());
this._overlay = null;
this._dimmer = null;
this._spotlight = null;
this._tooltip = null;
},

// ─── Helpers ─────────────────────────────────────────────────────────────────
_esperar(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
},

_btnPrincipal() {
return `background: var(--accent-yellow); color: var(--bg-primary); border: none; border-radius: 20px; padding: 10px 20px; font-weight: 700; font-size: 14px; cursor: pointer;`;
},

_btnSecundario() {
return `background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 20px; padding: 10px 16px; font-size: 14px; cursor: pointer;`;
},

// ─── Utilidad: resetear para pruebas desde consola ───────────────────────────
resetear() {
localStorage.removeItem(‘ri5_onboarding_done’);
console.log(‘✅ Onboarding reseteado. Se mostrará en el próximo registro.’);
}
};

window.Onboarding = Onboarding;