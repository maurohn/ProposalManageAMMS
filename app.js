/* ═══════════════════════════════════════════════════
   AMMS Group Proposal Engine — App Logic
   ═══════════════════════════════════════════════════ */

// ── STATE ──
let state = {
  uuid: null,
  general: {
    titulo: '',
    subtitulo: '',
    cliente: '',
    expediente: '',
    resumen: '',
    enfoque: '',
    metodologia: ''
  },
  sugerencias_metodologia: [],
  diferenciales: [],
  equipo: [],
  renglones: [],
  capacidades: [],
  notas: {
    modalidad: 'El trabajo se realizará de forma 100% remota. Solo se prevé presencia física (onsite) para reuniones de seguimiento, comités ejecutivos o casos especiales críticos.',
    costos: 'Todos los valores expresados se encuentran denominados en pesos argentinos (ARS) e incluyen IVA.',
    ajuste: 'El precio estipulado podrá ajustarse en caso de producirse un incremento salarial debidamente homologado.'
  },
  sla: [
    { id: 'sla-1', prioridad: 'P1', tipo: 'Caída total de operación o imposibilidad de ejecución crítica', respuesta: '< 2 hs', resolucion: '< 8 hs' },
    { id: 'sla-2', prioridad: 'P2', tipo: 'Afectación alta con alternativa parcial o impacto relevante', respuesta: '< 4 hs', resolucion: '< 24 hs' },
    { id: 'sla-3', prioridad: 'P3', tipo: 'Incidencia media, no bloqueante o correctivo planificable', respuesta: '< 8 hs', resolucion: '< 72 hs' },
    { id: 'sla-4', prioridad: 'P4', tipo: 'Mejoras menores, ajustes o evolutivos de baja criticidad', respuesta: '< 24 hs', resolucion: '< 5 días hábiles' }
  ],
  kpis: [
    { num: '99,5%', txt: 'Disponibilidad objetivo' },
    { num: '95%', txt: 'Cumplimiento SLA' },
    { num: '<24 hs', txt: 'MTTR promedio' },
    { num: '<2%', txt: 'Defectos en producción' },
    { num: '<10 días', txt: 'Lead time evolutivo medio' }
  ]
};

const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initGeneralInputs();
  initTags('diferenciales-editor', state.diferenciales);
  initTags('capacidades-editor', state.capacidades);
  renderEquipo();
  renderRenglones();
  renderSLA();
  renderKPIs();
  updateStats();
  initPreview();
  initAIUpload();

  // DB Save / Load
  const btnSave = document.getElementById('btn-save');
  if (btnSave) {
    btnSave.addEventListener('click', saveToDB);
  }
  const btnSavePreview = document.getElementById('btn-save-preview');
  if (btnSavePreview) {
    btnSavePreview.addEventListener('click', saveToDB);
  }
  const btnRefresh = document.getElementById('btn-refresh-props');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadProposalsList);
  }
  
  // Custom navigation logic to load proposals when clicking "mis-propuestas" tab
  document.querySelectorAll('.nav-item, .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.target || e.currentTarget.dataset.panel;
      if (target === 'mis-propuestas') {
        loadProposalsList();
      }
    });
  });
});

async function saveToDB() {
  const btn = document.getElementById('btn-save');
  const btnPrev = document.getElementById('btn-save-preview');
  
  const ogText = btn ? btn.innerHTML : 'Guardar Versión';
  const ogTextPrev = btnPrev ? btnPrev.innerHTML : 'Guardar Versión';
  
  if(btn) btn.innerHTML = 'Guardando...';
  if(btnPrev) btnPrev.innerHTML = 'Guardando...';
  
  try {
    const res = await fetch('http://localhost:3000/api/propuestas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: state.uuid,
        estado_json: state
      })
    });
    const data = await res.json();
    if(data.success) {
      state.uuid = data.uuid; // Set uuid if it was new
      showToast(`Guardado: Versión ${data.version}`, 'success');
    } else {
      showToast('Error al guardar', 'warn');
    }
  } catch(e) {
    showToast('Error de conexión', 'warn');
  } finally {
    if(btn) btn.innerHTML = ogText;
    if(btnPrev) btnPrev.innerHTML = ogTextPrev;
  }
}

async function loadProposalsList() {
  const container = document.getElementById('propuestas-list-container');
  container.innerHTML = '<p>Cargando...</p>';
  try {
    const res = await fetch('http://localhost:3000/api/propuestas');
    const list = await res.json();
    
    if (list.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No hay propuestas guardadas.</p>';
      return;
    }

    let html = `<table style="width:100%; border-collapse: collapse; margin-top:16px;">
      <tr style="border-bottom:1px solid var(--line); color:var(--muted); font-size:12px; text-align:left;">
        <th style="padding:8px">Cliente</th>
        <th style="padding:8px">Título</th>
        <th style="padding:8px">Última Versión</th>
        <th style="padding:8px">Acción</th>
      </tr>`;
    
    list.forEach(p => {
      html += `<tr style="border-bottom:1px solid var(--line); font-size:14px;">
        <td style="padding:12px 8px"><strong>${p.cliente}</strong></td>
        <td style="padding:12px 8px">${p.titulo}</td>
        <td style="padding:12px 8px">v${p.version}</td>
        <td style="padding:12px 8px"><button class="btn-sm btn-outline" onclick="loadProposal('${p.uuid}')">Editar</button></td>
      </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<p style="color:#ff4444">Error al cargar propuestas.</p>';
  }
}

window.loadProposal = async function(uuid) {
  try {
    const res = await fetch('http://localhost:3000/api/propuestas/' + uuid);
    const versions = await res.json();
    if(versions.length > 0) {
      const latest = versions[0];
      const newState = latest.estado_json;
      newState.uuid = latest.uuid;
      loadState(newState);
      showToast('Propuesta cargada (v'+latest.version+')', 'success');
      
      // Go to general tab
      const tabGeneral = document.querySelector('[data-panel="general"]') || document.querySelector('[data-target="general"]');
      if (tabGeneral) tabGeneral.click();
    }
  } catch (e) {
    showToast('Error al cargar la propuesta', 'warn');
  }
};

function loadState(newState) {
  state = newState;
  initGeneralInputs();
  initTags('diferenciales-editor', state.diferenciales);
  initTags('capacidades-editor', state.capacidades);
  renderEquipo();
  renderRenglones();
  renderSLA();
  renderKPIs();
  updateStats();
}

// ── NAVIGATION ──
function initNav() {
  document.querySelectorAll('.sidebar-nav > div, .sidebar-nav > button').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ignore separators
      if(!btn.dataset.panel && !btn.dataset.target) return;
      
      const targetPanel = btn.dataset.panel || btn.dataset.target;
      
      document.querySelectorAll('.sidebar-nav > div, .sidebar-nav > button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      const panelEl = document.getElementById('panel-' + targetPanel);
      if(panelEl) panelEl.classList.add('active');

      const titles = {
        'inicio': 'Generador IA',
        'general': 'Datos Generales y Contexto',
        'equipo': 'Estructura del Equipo',
        'renglones': 'Renglones de Contratación',
        'contenido': 'Capacidades y Notas',
        'sla': 'Calidad de Servicio',
        'mis-propuestas': 'Mis Propuestas Guardadas'
      };
      
      const titleEl = document.getElementById('current-tab-title');
      if (titleEl && titles[targetPanel]) {
        titleEl.textContent = titles[targetPanel];
      }
    });
  });
}

// ── GENERAL INPUTS ──
function initGeneralInputs() {
  ['titulo', 'subtitulo', 'cliente', 'expediente', 'resumen', 'enfoque', 'metodologia'].forEach(key => {
    const el = document.getElementById('prop-' + key);
    if(el) {
      el.value = state.general[key] || '';
      el.addEventListener('input', (e) => state.general[key] = e.target.value);
    }
  });

  renderMetodologiaSuggestions();

  ['modalidad', 'costos', 'ajuste'].forEach(key => {
    const el = document.getElementById('nota-' + key);
    if(el) {
      el.value = state.notas[key] || '';
      el.addEventListener('input', (e) => state.notas[key] = e.target.value);
    }
  });
}

function renderMetodologiaSuggestions() {
  const box = document.getElementById('metodologia-suggestions');
  if(!box) return;
  box.innerHTML = '';
  
  if (!state.sugerencias_metodologia || state.sugerencias_metodologia.length === 0) return;

  const header = document.createElement('p');
  header.style.cssText = "font-size: 0.8rem; color: var(--cyan-electric); margin: 0; font-weight: 600;";
  header.textContent = "✨ Sugerencias de la IA basadas en el pliego (hacé click para agregar al texto):";
  box.appendChild(header);

  state.sugerencias_metodologia.forEach((sug, idx) => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.style.cssText = "text-align: left; padding: 10px 14px; white-space: normal; line-height: 1.4;";
    chip.textContent = '+ ' + sug;
    chip.onclick = () => {
      const textarea = document.getElementById('prop-metodologia');
      const prefix = state.general.metodologia ? state.general.metodologia + '\n\n' : '';
      state.general.metodologia = prefix + sug;
      textarea.value = state.general.metodologia;
      
      // Remove it from suggestions
      state.sugerencias_metodologia.splice(idx, 1);
      renderMetodologiaSuggestions();
    };
    box.appendChild(chip);
  });
}

// ── TAGS EDITOR ──
function initTags(containerId, dataArray) {
  const container = document.getElementById(containerId);
  const list = container.querySelector('.tag-list');
  const input = container.querySelector('input');
  const btn = container.querySelector('button');

  const renderTags = () => {
    list.innerHTML = '';
    const classes = ['cyan', 'orange', 'navy'];
    dataArray.forEach((tag, idx) => {
      const el = document.createElement('div');
      el.className = `tag-pill ${classes[idx % classes.length]}`;
      el.innerHTML = `
        <span>${tag}</span>
        <button class="tag-remove" data-idx="${idx}">✕</button>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        dataArray.splice(e.target.dataset.idx, 1);
        renderTags();
        if(containerId === 'diferenciales-editor') renderSuggestions();
      });
    });
  };

  const renderSuggestions = () => {
    if(containerId !== 'diferenciales-editor') return;
    const box = document.getElementById('diferenciales-suggestions');
    if(!box) return;
    
    const sugerencias = [
      "Desarrollo asistido por IA", "QA Automatizado", "Reportes en PowerBI / Looker",
      "Migración progresiva sin downtime", "Metodología Ágil (Scrum/Kanban)",
      "Mesa de Ayuda 24/7", "Arquitectura en Microservicios", "Gobierno de Datos",
      "CI/CD automatizado", "Documentación formal de procesos"
    ];
    
    box.innerHTML = '';
    sugerencias.forEach(sug => {
      // Don't show if already added
      if(dataArray.includes(sug)) return;
      
      const chip = document.createElement('div');
      chip.className = 'suggestion-chip';
      chip.textContent = '+ ' + sug;
      chip.onclick = () => {
        dataArray.push(sug);
        renderTags();
        renderSuggestions();
      };
      box.appendChild(chip);
    });
  };

  const addTag = () => {
    const val = input.value.trim();
    if(val && !dataArray.includes(val)) {
      dataArray.push(val);
      input.value = '';
      renderTags();
      if(containerId === 'diferenciales-editor') renderSuggestions();
    }
  };

  btn.addEventListener('click', addTag);
  input.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTag(); });

  renderTags();
  renderSuggestions();
}

// ── EQUIPO ──
function renderEquipo() {
  const tbody = document.getElementById('equipo-tbody');
  tbody.innerHTML = '';

  state.equipo.forEach((item, idx) => {
    const costoMensual = item.cantidad * item.horas * item.valor_hora;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${item.perfil}" onchange="updateEquipo(${idx}, 'perfil', this.value)"></td>
      <td><input type="number" class="center-input" value="${item.cantidad}" onchange="updateEquipo(${idx}, 'cantidad', this.value)"></td>
      <td><input type="number" class="center-input" value="${item.horas}" onchange="updateEquipo(${idx}, 'horas', this.value)"></td>
      <td><input type="number" class="num" value="${item.valor_hora}" onchange="updateEquipo(${idx}, 'valor_hora', this.value)"></td>
      <td class="computed right">${formatCurrency(costoMensual)}</td>
      <td><input type="text" value="${item.responsabilidad}" onchange="updateEquipo(${idx}, 'responsabilidad', this.value)"></td>
      <td class="center"><button class="btn-sm btn-danger" onclick="removeEquipo(${idx})">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
  });

  updateStats();
}

window.updateEquipo = (idx, field, value) => {
  if(['cantidad', 'horas', 'valor_hora'].includes(field)) {
    state.equipo[idx][field] = Number(value);
  } else {
    state.equipo[idx][field] = value;
  }
  renderEquipo();
  renderRenglones(); // Recalculate renglones when equipo costs change
};

window.removeEquipo = (idx) => {
  state.equipo.splice(idx, 1);
  renderEquipo();
  renderRenglones();
};

document.getElementById('btn-add-perfil').addEventListener('click', () => {
  state.equipo.push({ id: 'eq-'+Date.now(), perfil: 'Nuevo Perfil', cantidad: 1, horas: 160, valor_hora: 40000, responsabilidad: '' });
  renderEquipo();
  renderRenglones();
});

// ── STATS ──
function updateStats() {
  let personas = 0, horas = 0, costoMensual = 0;
  
  state.equipo.forEach(eq => {
    personas += eq.cantidad;
    horas += eq.cantidad * eq.horas;
    costoMensual += eq.cantidad * eq.horas * eq.valor_hora;
  });

  const elPersonas = document.getElementById('hdr-personas');
  if(elPersonas) elPersonas.textContent = personas + ' per.';
  
  const elCosto = document.getElementById('hdr-costo');
  if(elCosto) elCosto.textContent = formatCurrency(costoMensual);
  
  // Backwards compatibility for old IDs just in case
  const oldPersonas = document.getElementById('stat-personas');
  if(oldPersonas) oldPersonas.textContent = personas;
  const oldHoras = document.getElementById('stat-horas');
  if(oldHoras) oldHoras.textContent = horas;
  const oldCosto = document.getElementById('stat-costo');
  if(oldCosto) oldCosto.textContent = formatCurrency(costoMensual);

  // Update tfoot
  const tfoot = document.getElementById('equipo-tfoot');
  tfoot.innerHTML = `
    <tr>
      <td><strong>Total General</strong></td>
      <td class="center">${personas}</td>
      <td class="center">${horas} hs/mes</td>
      <td></td>
      <td class="right">${formatCurrency(costoMensual)}</td>
      <td colspan="2"></td>
    </tr>
  `;
}

// ── RENGLONES ──
function renderRenglones() {
  const tbody = document.getElementById('renglones-tbody');
  tbody.innerHTML = '';
  
  let totalCosto = 0;
  state.equipo.forEach(eq => { totalCosto += eq.cantidad * eq.horas * eq.valor_hora; });

  state.renglones.forEach((item, idx) => {
    const costo = totalCosto * (item.porcentaje / 100);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="role-cell"><input type="text" value="${item.id}" onchange="updateRenglon(${idx}, 'id', this.value)"></td>
      <td><input type="text" value="${item.servicio}" onchange="updateRenglon(${idx}, 'servicio', this.value)"></td>
      <td><input type="number" class="center-input" value="${item.porcentaje}" onchange="updateRenglon(${idx}, 'porcentaje', this.value)"></td>
      <td class="computed right">${formatCurrency(costo)}</td>
      <td class="center"><button class="btn-sm btn-danger" onclick="removeRenglon(${idx})">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
  });

  renderRenglonesChart(totalCosto);
}

window.updateRenglon = (idx, field, value) => {
  if(field === 'porcentaje') {
    state.renglones[idx][field] = Number(value);
  } else {
    state.renglones[idx][field] = value;
  }
  renderRenglones();
};

window.removeRenglon = (idx) => {
  state.renglones.splice(idx, 1);
  renderRenglones();
};

document.getElementById('btn-add-renglon').addEventListener('click', () => {
  state.renglones.push({ id: `Renglón ${state.renglones.length+1}`, servicio: 'Nuevo servicio', porcentaje: 0 });
  renderRenglones();
});

function renderRenglonesChart(totalCosto) {
  const chart = document.getElementById('renglones-chart');
  chart.innerHTML = '';
  const classes = ['cyan', 'orange', 'navy'];
  
  state.renglones.forEach((r, idx) => {
    const costo = totalCosto * (r.porcentaje / 100);
    const div = document.createElement('div');
    div.className = 'chart-bar-group';
    div.innerHTML = `
      <span class="chart-label">${r.id} (${r.porcentaje}%)</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${classes[idx % classes.length]}" style="width: ${r.porcentaje}%;">${r.porcentaje}%</div>
      </div>
      <span class="chart-amount">${formatCurrency(costo)}</span>
    `;
    chart.appendChild(div);
  });
}

// ── SLA & KPIs ──
function renderSLA() {
  const tbody = document.getElementById('sla-tbody');
  tbody.innerHTML = '';
  state.sla.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="role-cell"><input type="text" value="${item.prioridad}" onchange="updateSla(${idx}, 'prioridad', this.value)"></td>
      <td><input type="text" value="${item.tipo}" onchange="updateSla(${idx}, 'tipo', this.value)"></td>
      <td><input type="text" class="center-input" value="${item.respuesta}" onchange="updateSla(${idx}, 'respuesta', this.value)"></td>
      <td><input type="text" class="center-input" value="${item.resolucion}" onchange="updateSla(${idx}, 'resolucion', this.value)"></td>
    `;
    tbody.appendChild(tr);
  });
}
window.updateSla = (idx, field, value) => { state.sla[idx][field] = value; };

function renderKPIs() {
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = '';
  state.kpis.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'kpi-card';
    div.innerHTML = `
      <input type="text" class="kpi-num center-input" value="${item.num}" style="font-size:1.3rem; font-weight:800; color:var(--deep-navy); padding:4px;" onchange="updateKpi(${idx}, 'num', this.value)">
      <input type="text" class="kpi-txt center-input" value="${item.txt}" style="font-size:0.8rem; margin-top:8px;" onchange="updateKpi(${idx}, 'txt', this.value)">
    `;
    grid.appendChild(div);
  });
}
window.updateKpi = (idx, field, value) => { state.kpis[idx][field] = value; };


// ── AI UPLOAD ──
function initAIUpload() {
  const btnTrigger = document.getElementById('btn-trigger-upload');
  const input = document.getElementById('pdf-upload-main');
  const dropArea = document.getElementById('drop-area');

  if(btnTrigger) {
    btnTrigger.addEventListener('click', () => {
      input.click();
    });
  }

  // Drag and drop events
  if(dropArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => dropArea.style.borderColor = 'var(--cyan-electric)', false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => dropArea.style.borderColor = 'var(--line)', false);
    });

    dropArea.addEventListener('drop', (e) => {
      let dt = e.dataTransfer;
      let files = dt.files;
      if(files.length) {
        input.files = files;
        input.dispatchEvent(new Event('change'));
      }
    }, false);
  }

  if(input) {
    input.addEventListener('change', async (e) => {
      if(!e.target.files[0]) return;
      
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('pdf', file);

      const originalText = btnTrigger.innerHTML;
      btnTrigger.innerHTML = `<span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid var(--deep-navy); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> Procesando...`;
      btnTrigger.style.pointerEvents = 'none';
      dropArea.style.pointerEvents = 'none';
      dropArea.style.opacity = '0.6';
      
      // Add keyframes for spinner if not exists
      if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      try {
        showToast('Subiendo PDF y analizando con Gemini API...', 'info');
        const res = await fetch('http://localhost:3000/api/analyze-pdf', {
          method: 'POST',
          body: formData
        });
        
        if(!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al procesar el PDF');
        }

        const data = await res.json();
        
        // Update state with AI data
        if(data.titulo) state.general.titulo = data.titulo;
        if(data.subtitulo) state.general.subtitulo = data.subtitulo;
        if(data.cliente) state.general.cliente = data.cliente;
        if(data.expediente) state.general.expediente = data.expediente;
        if(data.resumen) state.general.resumen = data.resumen;
        if(data.enfoque) state.general.enfoque = data.enfoque;
        state.general.metodologia = ''; // Clear so they use suggestions
        state.sugerencias_metodologia = data.sugerencias_metodologia || [];
        state.diferenciales = data.diferenciales || [];
        if(data.capacidades && data.capacidades.length) state.capacidades = data.capacidades;
        if(data.equipo && data.equipo.length) state.equipo = data.equipo.map((eq,i) => ({id: 'eq-'+Date.now()+i, ...eq}));
        if(data.renglones && data.renglones.length) state.renglones = data.renglones;

        // Re-render UI
        initGeneralInputs();
        initTags('diferenciales-editor', state.diferenciales);
        initTags('capacidades-editor', state.capacidades);
        renderEquipo();
        renderRenglones();
        
        showToast('Propuesta generada automáticamente por IA', 'success');
        document.getElementById('nav-general').click(); // Auto-navigate to General
        
      } catch(err) {
        console.error(err);
        showToast('Error: ' + err.message, 'warn');
      } finally {
        btnTrigger.innerHTML = originalText;
        btnTrigger.style.pointerEvents = 'auto';
        dropArea.style.pointerEvents = 'auto';
        dropArea.style.opacity = '1';
        input.value = '';
      }
    });
  }
}


// ── TOAST ──
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}


// ── PREVIEW GENERATION ──
function initPreview() {
  const overlay = document.getElementById('preview-overlay');
  const iframe = document.getElementById('preview-iframe');
  
  document.getElementById('btn-preview').addEventListener('click', () => {
    generateHTML();
    overlay.classList.add('open');
  });

  document.getElementById('btn-close-preview').addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  document.getElementById('btn-print').addEventListener('click', () => {
    iframe.contentWindow.print();
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "amms_propuesta_data.json");
    dlAnchorElem.click();
    showToast('Datos guardados correctamente', 'success');
  });
}

function generateHTML() {
  let personas = 0, horas = 0, costoMensual = 0;
  state.equipo.forEach(eq => {
    personas += eq.cantidad;
    horas += eq.cantidad * eq.horas;
    costoMensual += eq.cantidad * eq.horas * eq.valor_hora;
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  :root {
    --deep-navy:#0A2342; --cyan-electric:#00F0FF; --orange-kinetic:#FF6B35;
    --ink:#1E2B3A; --muted:#627387; --line:#D7E1EB; --paper:#F4F7FB; --green-dark:#2E6E59;
  }
  * { box-sizing:border-box; }
  body { margin:0; padding:0; background:var(--paper); color:var(--ink); font-family:Inter, Arial, sans-serif; }
  .page { width:210mm; min-height:297mm; margin:0 auto 14px auto; background:#fff; overflow:hidden; position:relative; }
  .page-inner { padding:17mm 16mm 16mm 16mm; }
  .hero { position:relative; border-radius:24px; padding:28px; color:#fff; background:linear-gradient(135deg, var(--deep-navy), #143a67 70%); }
  .eyebrow { display:inline-flex; align-items:center; gap:8px; color:var(--cyan-electric); text-transform:uppercase; font-size:11px; font-weight:800; letter-spacing:1px; }
  .eyebrow .dot { width:8px; height:8px; border-radius:999px; background:var(--orange-kinetic); }
  h1 { margin:14px 0 10px 0; font:800 30px/1.08 Montserrat, sans-serif; letter-spacing:-.5px; }
  .hero p { margin:0; font-size:13.2px; color:rgba(255,255,255,.92); }
  .hero-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:18px; }
  .hero-card { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.10); border-radius:18px; padding:16px; }
  .hero-card h3 { margin:0 0 10px 0; color:#fff; font:700 15px/1.2 Montserrat, sans-serif; }
  .hero-card li { position:relative; padding-left:18px; margin:0 0 9px 0; font-size:12px; }
  .hero-card li:before { content:""; width:8px; height:8px; border-radius:999px; position:absolute; left:0; top:5px; background:linear-gradient(135deg, var(--cyan-electric), var(--orange-kinetic)); }
  .meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:18px; }
  .stat { padding:12px; border-radius:14px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.10); }
  .stat .label { font-size:10px; text-transform:uppercase; color:rgba(255,255,255,.72); }
  .stat .value { margin-top:8px; font:800 20px/1.05 Montserrat, sans-serif; color:#fff; }
  .section-header { display:flex; align-items:center; gap:12px; margin:18px 0 12px 0; }
  .section-number { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:var(--deep-navy); color:#fff; font-weight:800; }
  h2 { margin:0; color:var(--deep-navy); font:800 20px/1.2 Montserrat, sans-serif; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; }
  .card.cyan { background:linear-gradient(180deg, rgba(0,240,255,.08), rgba(255,255,255,0)); }
  .card.orange { background:linear-gradient(180deg, rgba(255,107,53,.08), rgba(255,255,255,0)); }
  table { width:100%; border-collapse:collapse; font-size:11.1px; }
  thead th { background:var(--green-dark); color:#fff; text-align:left; padding:10px; font-weight:700; }
  tbody td { padding:10px; border-bottom:1px solid var(--line); }
  td.role { color:var(--deep-navy); font-weight:700; }
  .kpi-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
  .kpi { background:#fff; border:1px solid var(--line); border-radius:16px; padding:14px; text-align:center; }
  .kpi .num { color:var(--deep-navy); font:800 20px/1.05 Montserrat, sans-serif; }
  .kpi .txt { margin-top:6px; font-size:11px; }
  .note { margin-top:12px; padding:14px; border-radius:16px; border:1px solid rgba(255,107,53,.20); background:rgba(255,107,53,.08); }
  .brand-footer { display:flex; justify-content:space-between; margin-top:18px; border-top:2px solid rgba(10,35,66,.08); padding-top:14px; font-size:11px; color:var(--muted); }
  .brand-footer { display:flex; justify-content:space-between; margin-top:18px; border-top:2px solid rgba(10,35,66,.08); padding-top:14px; font-size:11px; color:var(--muted); }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #fff; }
    .page { box-shadow:none; margin:0; page-break-after: always; }
  }
</style>
</head>
<body>
<!-- PAGINA 1 -->
<section class="page">
  <div class="page-inner">
    <div class="hero">
      <div class="eyebrow"><span class="dot"></span> ${state.general.cliente} - ${state.general.expediente}</div>
      <h1>${state.general.titulo}<br>${state.general.subtitulo}</h1>
      <p>${state.general.resumen}</p>
      <div class="hero-grid">
        <div class="hero-card">
          <h3>Diferenciales</h3>
          <ul style="list-style:none; padding:0; margin:0; color:white;">
            ${state.diferenciales.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
        <div class="hero-card">
          <h3>Enfoque Ejecutivo</h3>
          <p style="font-size:12px; margin-bottom:8px;">${state.general.enfoque}</p>
        </div>
      </div>
      <div class="meta-grid">
        <div class="stat"><div class="label">Dotación</div><div class="value">${personas} per.</div></div>
        <div class="stat"><div class="label">Capacidad</div><div class="value">${horas} hs/m</div></div>
        <div class="stat"><div class="label">Costo Mensual</div><div class="value" style="font-size:16px">${formatCurrency(costoMensual)}</div></div>
        <div class="stat"><div class="label">Valor Hr Promedio</div><div class="value" style="font-size:16px">${formatCurrency(costoMensual/horas)}</div></div>
      </div>
    </div>
    
    ${state.general.metodologia ? `
    <div class="section-header" style="margin-top:24px;"><div class="section-number">1</div><h2>Metodología y Detalles de Ejecución</h2></div>
    <div class="card" style="margin-bottom:16px;">
      <p style="font-size:12px; line-height:1.6; margin:0; white-space:pre-wrap;">${state.general.metodologia}</p>
    </div>
    ` : ''}

    <div class="section-header"><div class="section-number">${state.general.metodologia ? '2' : '1'}</div><h2>Estructura del equipo y valores hora</h2></div>
    <div style="border:1px solid var(--line); border-radius:18px; overflow:hidden;">
      <table>
        <thead>
          <tr><th>Perfil</th><th>Cant.</th><th>Hs/mes</th><th>Valor hora</th><th>Costo mensual</th><th>Responsabilidad</th></tr>
        </thead>
        <tbody>
          ${state.equipo.map(eq => `
            <tr>
              <td class="role">${eq.perfil}</td>
              <td style="text-align:center">${eq.cantidad}</td>
              <td style="text-align:center">${eq.horas}</td>
              <td style="text-align:right">${formatCurrency(eq.valor_hora)}</td>
              <td style="text-align:right">${formatCurrency(eq.cantidad*eq.horas*eq.valor_hora)}</td>
              <td style="font-size:10px">${eq.responsabilidad}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section-header"><div class="section-number">${state.general.metodologia ? '3' : '2'}</div><h2>Renglones</h2></div>
    <div style="border:1px solid var(--line); border-radius:18px; overflow:hidden;">
      <table>
        <thead><tr><th>Renglón</th><th>Servicio</th><th>Porcentaje</th><th>Monto Mensual</th></tr></thead>
        <tbody>
          ${state.renglones.map(r => `
            <tr>
              <td class="role">${r.id}</td><td>${r.servicio}</td>
              <td style="text-align:center">${r.porcentaje}%</td>
              <td style="text-align:right">${formatCurrency(costoMensual * (r.porcentaje/100))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card cyan" style="margin-top:16px;">
      <h3 style="margin-top:0; color:var(--deep-navy);">Alineación de Capacidades</h3>
      <p style="font-size:12px; margin:0;">
        ${state.capacidades.map(c => `• ${c}<br>`).join('')}
      </p>
    </div>

    <div class="note">
      <p style="margin:0; font-size:11px;">
        <strong>Modalidad:</strong> ${state.notas.modalidad}<br>
        <strong>Costos:</strong> ${state.notas.costos}<br>
        <strong>Ajuste:</strong> ${state.notas.ajuste}
      </p>
    </div>
  </div>
</section>

<!-- PAGINA 2 -->
<section class="page">
  <div class="page-inner">
    <div class="section-header"><div class="section-number">${state.general.metodologia ? '4' : '3'}</div><h2>SLA, KPIs y calidad de servicio</h2></div>
    <div style="border:1px solid var(--line); border-radius:18px; overflow:hidden; margin-bottom:16px;">
      <table>
        <thead><tr><th>Prioridad</th><th>Tipo de incidente</th><th>Respuesta</th><th>Resolución</th></tr></thead>
        <tbody>
          ${state.sla.map(s => `<tr><td class="role">${s.prioridad}</td><td>${s.tipo}</td><td style="text-align:center">${s.respuesta}</td><td style="text-align:center">${s.resolucion}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="kpi-grid">
      ${state.kpis.map(k => `<div class="kpi"><div class="num">${k.num}</div><div class="txt">${k.txt}</div></div>`).join('')}
    </div>

    <div class="brand-footer" style="margin-top:40px;">
      <div>AMMS Group · Software + Datos + Automatización · Propuesta corporativa</div>
    </div>
  </div>
</section>
</body></html>`;

  const iframe = document.getElementById('preview-iframe');
  iframe.srcdoc = htmlContent;
}
