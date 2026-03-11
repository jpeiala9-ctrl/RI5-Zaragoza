// ==================== admin.js - Panel de Administración CORREGIDO ====================

const Admin = {
  chartInstance: null,

  async init() {
    console.log('Admin.init() iniciado');
    this.mostrarCarga();

    if (!navigator.onLine) {
      this.mostrarError('Sin conexión a internet');
      return;
    }

    if (!window.firebaseServices || !firebaseServices.db) {
      this.mostrarError('Firebase no está inicializado');
      return;
    }

    try {
      await this.actualizarAdminPanel();
    } catch (e) {
      console.error('Error en actualizarAdminPanel:', e);
    }

    try {
      await this.cargarUsuariosSelect();
    } catch (e) {
      console.error('Error en cargarUsuariosSelect:', e);
    }

    try {
      await this.cargarMensajesRecibidosAdmin();
    } catch (e) {
      console.error('Error en cargarMensajesRecibidosAdmin:', e);
    }

    try {
      await this.cargarMensajesEnviadosAdmin();
    } catch (e) {
      console.error('Error en cargarMensajesEnviadosAdmin:', e);
    }

    try {
      await this.cargarTodosLosUsuarios(); // VERSIÓN CORREGIDA
    } catch (e) {
      console.error('Error en cargarTodosLosUsuarios:', e);
    }

    try {
      await this.cargarGraficaRegistros();
    } catch (e) {
      console.error('Error en cargarGraficaRegistros:', e);
    }

    console.log('Admin.init() completado');
  },

  mostrarCarga() {
    const stats = document.getElementById('adminStats');
    if (stats) stats.innerHTML = '<span class="stat-badge">📊 Cargando...</span>';
    const tabla = document.getElementById('tablaUsuariosContainer');
    if (tabla) tabla.innerHTML = '<p style="text-align:center; padding:20px;">Cargando usuarios...</p>';
    const select = document.getElementById('adminSelectorUsuarios');
    if (select) select.innerHTML = '<option value="">Cargando usuarios...</option>';
  },

  mostrarError(mensaje) {
    const stats = document.getElementById('adminStats');
    if (stats) stats.innerHTML = `<span class="stat-badge" style="color:var(--zone-5);">❌ Error: ${mensaje}</span>`;
    const tabla = document.getElementById('tablaUsuariosContainer');
    if (tabla) tabla.innerHTML = `<p style="color:var(--zone-5); text-align:center;">Error: ${mensaje} <br><button class="action-button" onclick="Admin.init()" style="margin-top:10px;">🔄 Reintentar</button></p>`;
    const select = document.getElementById('adminSelectorUsuarios');
    if (select) select.innerHTML = '<option value="">Error al cargar</option>';
  },

  // ==================== ESTADÍSTICAS RÁPIDAS ====================
  async actualizarAdminPanel() {
    const statsEl = document.getElementById('adminStats');
    if (!statsEl) return;

    try {
      console.log('actualizarAdminPanel: obteniendo usuarios...');
      const snapshot = await firebaseServices.db.collection('users').get();
      const now = new Date();
      let total = 0, activos = 0, expirados = 0, admins = 0, pendientes = 0;

      snapshot.forEach(doc => {
        const user = doc.data();
        total++;
        if (user.isAdmin) admins++;

        const expiry = user.expires ? new Date(user.expires) : null;
        const premiumActivo = user.premium && expiry && expiry > now;

        if (premiumActivo) activos++;
        else {
          expirados++;
          if (!user.isAdmin) pendientes++;
        }
      });

      statsEl.innerHTML = `
        <span class="stat-badge">📊 TOTAL <span class="number">${total}</span></span>
        <span class="stat-badge">✅ ACTIVOS <span class="number">${activos}</span></span>
        <span class="stat-badge">⏳ EXPIRADOS <span class="number">${expirados}</span></span>
        <span class="stat-badge pending">🆕 PENDIENTES <span class="number">${pendientes}</span></span>
        <span class="stat-badge">👑 ADMINS <span class="number">${admins}</span></span>
      `;
      console.log('Estadísticas actualizadas');
    } catch (error) {
      console.error('Error actualizando estadísticas:', error);
      statsEl.innerHTML = `<span class="stat-badge" style="color:var(--zone-5);">❌ Error: ${error.message}</span>`;
      throw error;
    }
  },

  // ==================== LISTA COMPLETA DE USUARIOS EN TABLA (VERSIÓN CORREGIDA) ====================
  async cargarTodosLosUsuarios() {
    const container = document.getElementById('tablaUsuariosContainer');
    if (!container) {
      console.error('❌ contenedor tablaUsuariosContainer no encontrado');
      return;
    }

    try {
      console.log('📡 Cargando usuarios...');
      const snapshot = await firebaseServices.db.collection('users').get();

      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay usuarios</p>';
        return;
      }

      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          username: data.username || '?',
          email: data.email || '',
          created: data.created,
          lastLogin: data.lastLogin,
          premium: data.premium || false,
          expires: data.expires,
          isAdmin: data.isAdmin || false
        };
      });

      users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

      let html = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Registro</th>
              <th>Último acceso</th>
              <th>Premium</th>
              <th>Expira</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
      `;

      users.forEach(user => {
        const registro = user.created ? new Date(user.created).toLocaleDateString() : '-';

        // ✅ Manejo robusto de lastLogin (puede ser Timestamp, string o undefined)
        let lastLogin = 'Nunca';
        if (user.lastLogin) {
          if (user.lastLogin.seconds) { // es Timestamp de Firestore
            lastLogin = new Date(user.lastLogin.seconds * 1000).toLocaleString();
          } else if (typeof user.lastLogin === 'string') {
            lastLogin = user.lastLogin;
          } else {
            lastLogin = String(user.lastLogin);
          }
        }

        const premiumActivo = user.premium && user.expires && new Date(user.expires) > new Date();
        const expiry = user.expires ? new Date(user.expires).toLocaleDateString() : '-';

        // Escapar posibles comillas en username para evitar errores HTML
        const usernameSafe = user.username.replace(/"/g, '&quot;');

        html += `
          <tr>
            <td>${usernameSafe}</td>
            <td>${user.email}</td>
            <td>${registro}</td>
            <td>${lastLogin}</td>
            <td>${premiumActivo ? '✅' : '❌'}</td>
            <td>${expiry}</td>
            <td>
              <button class="action-button small" onclick="Admin.togglePremium('${user.uid}')">🔄</button>
              <button class="action-button small" onclick="Admin.enviarMensajeRapido('${user.uid}', '${usernameSafe}')">💬</button>
              <button class="action-button small" onclick="Admin.eliminarUsuario('${user.uid}')" style="color:var(--zone-5);">🗑️</button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
      console.log('✅ Tabla de usuarios cargada correctamente');

    } catch (error) {
      console.error('❌ Error en cargarTodosLosUsuarios:', error);
      container.innerHTML = `
        <p style="color:var(--zone-5); text-align:center; padding:20px;">
          ⚠️ Error: ${error.message}<br>
          <button class="action-button" onclick="Admin.cargarTodosLosUsuarios()" style="margin-top:10px;">
            🔄 Reintentar
          </button>
        </p>
      `;
    }
  },

  // ==================== GRÁFICA DE REGISTROS MENSUALES ====================
  async cargarGraficaRegistros() {
    const canvas = document.getElementById('graficaRegistros');
    if (!canvas) {
      console.error('Canvas graficaRegistros no encontrado');
      return;
    }

    try {
      console.log('cargarGraficaRegistros: obteniendo datos...');
      const snapshot = await firebaseServices.db.collection('users').get();
      const registrosPorMes = {};

      snapshot.docs.forEach(doc => {
        const user = doc.data();
        if (user.created) {
          const fecha = new Date(user.created);
          const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
          registrosPorMes[mes] = (registrosPorMes[mes] || 0) + 1;
        }
      });

      const meses = Object.keys(registrosPorMes).sort();
      const datos = meses.map(m => registrosPorMes[m]);

      if (this.chartInstance) this.chartInstance.destroy();

      if (meses.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Inter';
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos de registros', canvas.width / 2, canvas.height / 2);
        console.log('Gráfica: sin datos');
        return;
      }

      this.chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [{
            label: 'Nuevos registros',
            data: datos,
            backgroundColor: 'var(--accent-blue)',
            borderColor: 'var(--border-color)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: 'var(--text-secondary)' } },
            x: { ticks: { color: 'var(--text-secondary)' } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
      console.log('Gráfica cargada');
    } catch (error) {
      console.error('Error cargando gráfica:', error);
    }
  },

  // ==================== VOLVER A LA VISTA DE USUARIO ====================
  volverAVistaUsuario() {
    document.getElementById("adminPage").style.display = "none";
    document.getElementById("mainContent").style.display = "flex";
  },

  // ==================== GESTIÓN DE USUARIOS (MODALES) ====================
  async abrirModalUsuarios(filtro = 'todos') {
    const modal = document.getElementById('modalUsuarios');
    const titulo = document.getElementById('modalUsuariosTitulo');
    const lista = document.getElementById('modalUserList');
    const inputBuscar = document.getElementById('modalBuscarUsuario');

    if (!modal || !titulo || !lista || !inputBuscar) return;

    titulo.innerText = filtro === 'premium' ? '👑 USUARIOS PREMIUM' : '👥 TODOS LOS USUARIOS';
    modal.classList.add('active');
    lista.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando...</div>';

    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      let users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

      if (filtro === 'premium') {
        const now = new Date();
        users = users.filter(u => u.premium && new Date(u.expires) > now);
      }

      users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
      this.renderizarListaUsuarios(users, lista);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      lista.innerHTML = '<p style="color:var(--zone-5); text-align:center;">Error al cargar</p>';
    }

    inputBuscar.oninput = () => {
      const texto = inputBuscar.value.toLowerCase();
      document.querySelectorAll('.usuario-item').forEach(item => {
        const nombre = item.querySelector('.usuario-header span')?.innerText.toLowerCase() || '';
        item.style.display = nombre.includes(texto) ? 'block' : 'none';
      });
    };
  },

  renderizarListaUsuarios(users, container) {
    if (users.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:20px;">No hay usuarios</p>';
      return;
    }

    let html = '';
    users.forEach(user => {
      const expiry = user.expires ? new Date(user.expires).toLocaleDateString() : 'No definida';
      const premiumActivo = user.premium && new Date(user.expires) > new Date();
      const usernameSafe = (user.username || '?').replace(/"/g, '&quot;');
      html += `
        <div class="usuario-item" data-uid="${user.uid}">
          <div class="usuario-header" onclick="this.parentNode.classList.toggle('abierto')">
            <span>${usernameSafe}</span>
            <span class="flecha">▼</span>
          </div>
          <div class="usuario-detalle">
            <div class="user-details">
              <span>📧 ${user.email || ''}</span>
              <span>📅 ${user.created ? new Date(user.created).toLocaleDateString() : ''}</span>
              <span>⏳ Exp: ${expiry}</span>
              <span>💰 ${premiumActivo ? 'PREMIUM' : 'GRATIS'}</span>
              ${user.isAdmin ? '<span>👑 ADMIN</span>' : ''}
            </div>
            <div class="modal-user-actions">
              <button onclick="Admin.togglePremium('${user.uid}')">🔄 ${premiumActivo ? 'Quitar premium' : 'Dar premium 1 mes'}</button>
              <button onclick="Admin.enviarMensajeRapido('${user.uid}', '${usernameSafe}')">💬 Mensaje</button>
              <button onclick="Admin.eliminarUsuario('${user.uid}')" style="color:var(--zone-5);">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  async togglePremium(uid) {
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) return;
      const user = userDoc.data();
      const now = new Date();
      if (user.premium && new Date(user.expires) > now) {
        const newExpiry = new Date(now.getTime() - 86400000).toISOString();
        await firebaseServices.db.collection('users').doc(uid).update({ premium: false, expires: newExpiry });
        Utils.showToast('✅ Premium eliminado', 'success');
      } else {
        const newExpiry = new Date(); newExpiry.setMonth(newExpiry.getMonth() + 1);
        await firebaseServices.db.collection('users').doc(uid).update({ premium: true, expires: newExpiry.toISOString() });
        Utils.showToast('✅ Premium añadido (1 mes)', 'success');
      }
      if (document.getElementById('modalUsuarios').classList.contains('active')) await this.abrirModalUsuarios('todos');
      await this.actualizarAdminPanel();
      await this.cargarTodosLosUsuarios();
    } catch (error) {
      console.error('Error toggling premium:', error);
      Utils.showToast('Error al cambiar premium', 'error');
    }
  },

  async eliminarUsuario(uid) {
    const confirmed = await Utils.confirm('ELIMINAR USUARIO', '¿Eliminar permanentemente este usuario?');
    if (!confirmed) return;
    try {
      await firebaseServices.db.collection('users').doc(uid).delete();
      await firebaseServices.db.collection('mensajes').doc(uid).delete();
      await firebaseServices.db.collection('mensajes').doc(`admin_${uid}`).delete();
      Utils.showToast('✅ Usuario eliminado de Firestore', 'success');
      if (document.getElementById('modalUsuarios').classList.contains('active')) await this.abrirModalUsuarios('todos');
      await this.actualizarAdminPanel();
      await this.cargarTodosLosUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      Utils.showToast('Error al eliminar usuario', 'error');
    }
  },

  // ==================== USUARIOS PENDIENTES ====================
  async abrirModalPendientes() {
    const modal = document.getElementById('modalPendientes');
    const lista = document.getElementById('listaPendientes');
    if (!modal || !lista) return;
    modal.classList.add('active');
    lista.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando...</div>';
    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      const now = new Date();
      const pendientes = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(u => !u.isAdmin && (!u.premium || new Date(u.expires) <= now))
        .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
      if (pendientes.length === 0) {
        lista.innerHTML = '<p style="text-align:center; padding:20px;">No hay usuarios pendientes</p>';
        return;
      }
      let html = '';
      pendientes.forEach(user => {
        const usernameSafe = (user.username || '?').replace(/"/g, '&quot;');
        html += `
          <div class="usuario-pendiente">
            <div class="usuario-header" onclick="this.parentNode.classList.toggle('abierto')">
              <span>${usernameSafe} (${user.email})</span>
              <span class="flecha">▼</span>
            </div>
            <div class="usuario-detalle">
              <div class="user-details">
                <span>📅 Registro: ${user.created ? new Date(user.created).toLocaleDateString() : ''}</span>
                <span>⏳ Expira: ${user.expires ? new Date(user.expires).toLocaleDateString() : 'No'}</span>
              </div>
              <button class="btn-enterado" onclick="Admin.marcarComoAtendido('${user.uid}')">✅ ENTERADO</button>
            </div>
          </div>
        `;
      });
      lista.innerHTML = html;
    } catch (error) {
      console.error('Error cargando pendientes:', error);
      lista.innerHTML = '<p style="color:var(--zone-5);">Error al cargar</p>';
    }
  },

  marcarComoAtendido(uid) {
    Utils.showToast('✅ Marcado como atendido (solo vista)', 'success');
    this.abrirModalPendientes();
  },

  // ==================== EXPORTAR CSV ====================
  async exportarUsuariosCSV() {
    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      const cabecera = 'Usuario,Email,Registro,UltimoAcceso,Expira,Premium,Admin,UID\n';
      const filas = users.map(u => {
        const premiumActivo = u.premium && new Date(u.expires) > new Date();
        let lastLogin = '';
        if (u.lastLogin) {
          if (u.lastLogin.seconds) {
            lastLogin = new Date(u.lastLogin.seconds * 1000).toLocaleString();
          } else {
            lastLogin = String(u.lastLogin);
          }
        }
        return [
          u.username || '',
          u.email || '',
          u.created ? new Date(u.created).toLocaleDateString() : '',
          lastLogin,
          u.expires ? new Date(u.expires).toLocaleDateString() : '',
          premiumActivo ? 'SÍ' : 'NO',
          u.isAdmin ? 'SÍ' : 'NO',
          u.uid
        ].map(c => `"${c}"`).join(',');
      }).join('\n');
      const csv = cabecera + filas;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'usuarios_ri5.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Utils.showToast('✅ CSV generado', 'success');
    } catch (error) {
      console.error('Error exportando CSV:', error);
      Utils.showToast('Error al exportar', 'error');
    }
  },

  // ==================== RENOVAR EXPIRADOS ====================
  async renovarExpirados() {
    const confirmed = await Utils.confirm('RENOVAR EXPIRADOS', '¿Extender 1 mes a todos los usuarios expirados?');
    if (!confirmed) return;
    Utils.showLoading();
    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      const now = new Date();
      const batch = firebaseServices.db.batch();
      snapshot.docs.forEach(doc => {
        const user = doc.data();
        const expiry = user.expires ? new Date(user.expires) : null;
        if (!user.isAdmin && (!user.premium || (expiry && expiry <= now))) {
          const newExpiry = new Date();
          newExpiry.setMonth(newExpiry.getMonth() + 1);
          batch.update(doc.ref, { premium: true, expires: newExpiry.toISOString() });
        }
      });
      await batch.commit();
      Utils.showToast('✅ Usuarios expirados renovados', 'success');
      await this.actualizarAdminPanel();
      await this.cargarTodosLosUsuarios();
    } catch (error) {
      console.error('Error renovando expirados:', error);
      Utils.showToast('Error al renovar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ==================== SOPORTE ADMIN (con opción "Todos") ====================
  async cargarUsuariosSelect() {
    const select = document.getElementById('adminSelectorUsuarios');
    if (!select) return;
    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      const users = snapshot.docs
        .map(doc => ({ uid: doc.id, username: doc.data().username }))
        .filter(u => u.username)
        .sort((a, b) => a.username.localeCompare(b.username));

      select.innerHTML = '<option value="">-- Selecciona usuario --</option>';
      select.innerHTML += '<option value="ALL">📢 TODOS LOS USUARIOS</option>';
      users.forEach(u => {
        const usernameSafe = u.username.replace(/"/g, '&quot;');
        select.innerHTML += `<option value="${u.uid}">${usernameSafe}</option>`;
      });
      console.log('Selector de usuarios cargado');
    } catch (error) {
      console.error('Error cargando usuarios para select:', error);
      select.innerHTML = '<option value="">Error al cargar</option>';
    }
  },

  async enviarMensajeAdmin() {
    const uid = document.getElementById('adminSelectorUsuarios').value;
    const texto = document.getElementById('adminMensaje').value.trim();
    if (!uid || !texto) {
      Utils.showToast('Selecciona un usuario (o TODOS) y escribe un mensaje', 'warning');
      return;
    }

    try {
      if (uid === 'ALL') {
        const snapshot = await firebaseServices.db.collection('users').get();
        const users = snapshot.docs.map(doc => doc.id);
        for (const userId of users) {
          await Storage.enviarMensajeAdminAUsuario(userId, texto);
        }
        Utils.showToast(`✅ Mensaje enviado a ${users.length} usuarios`, 'success');
      } else {
        await Storage.enviarMensajeAdminAUsuario(uid, texto);
        Utils.showToast('✅ Mensaje enviado', 'success');
      }
      document.getElementById('adminMensaje').value = '';
      await this.cargarMensajesEnviadosAdmin();
    } catch (error) {
      console.error('Error enviando mensaje admin:', error);
      Utils.showToast('Error al enviar', 'error');
    }
  },

  async cargarMensajesRecibidosAdmin() {
    const container = document.getElementById('listaMensajesRecibidosAdmin');
    if (!container) return;
    try {
      const snapshot = await firebaseServices.db.collection('mensajes').get();
      const mensajesRecibidos = [];
      for (const doc of snapshot.docs) {
        const docId = doc.id;
        if (docId.startsWith('admin_')) continue;
        const data = doc.data();
        const mensajes = data.mensajes || [];
        const usuarioUid = docId;
        let username = 'Desconocido';
        try {
          const userDoc = await firebaseServices.db.collection('users').doc(usuarioUid).get();
          if (userDoc.exists) username = userDoc.data().username || '?';
        } catch (e) {}
        mensajes.forEach((msg, idx) => {
          if (msg.esUsuario) {
            mensajesRecibidos.push({
              uid: usuarioUid, username, idx,
              fecha: msg.fecha, texto: msg.texto, leido: msg.leido,
              timestamp: msg.timestamp?.toDate?.() || new Date(msg.fecha)
            });
          }
        });
      }
      mensajesRecibidos.sort((a, b) => b.timestamp - a.timestamp);
      if (mensajesRecibidos.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay mensajes de usuarios</p>';
        return;
      }
      let html = '';
      mensajesRecibidos.forEach(msg => {
        const noLeido = !msg.leido ? 'nuevo' : '';
        const usernameSafe = msg.username.replace(/"/g, '&quot;');
        html += `
          <div class="mensaje-item ${noLeido}" data-uid="${msg.uid}" data-idx="${msg.idx}">
            <div class="mensaje-header" onclick="this.parentNode.classList.toggle('abierto')">
              <span>📨 ${msg.fecha} · ${usernameSafe}</span>
              <span class="flecha">▼</span>
              <button class="delete-mensaje" onclick="event.stopPropagation(); Admin.borrarMensajeUsuario('${msg.uid}', ${msg.idx}, true)">🗑️</button>
            </div>
            <div class="mensaje-contenido">${msg.texto}</div>
          </div>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Error cargando mensajes recibidos admin:', error);
      container.innerHTML = '<p style="color:var(--zone-5);">Error al cargar</p>';
    }
  },

  async cargarMensajesEnviadosAdmin() {
    const container = document.getElementById('listaMensajesEnviadosAdmin');
    if (!container) return;
    try {
      const snapshot = await firebaseServices.db.collection('mensajes').get();
      const mensajesEnviados = [];
      for (const doc of snapshot.docs) {
        const docId = doc.id;
        const data = doc.data();
        const mensajes = data.mensajes || [];
        let destino = docId;
        if (docId.startsWith('admin_')) destino = docId.replace('admin_', '');
        let username = 'Desconocido';
        try {
          const userDoc = await firebaseServices.db.collection('users').doc(destino).get();
          if (userDoc.exists) username = userDoc.data().username || '?';
        } catch (e) {}
        mensajes.forEach((msg, idx) => {
          if (msg.esAdmin) {
            mensajesEnviados.push({
              uid: destino, username, idx,
              fecha: msg.fecha, texto: msg.texto,
              timestamp: msg.timestamp?.toDate?.() || new Date(msg.fecha)
            });
          }
        });
      }
      mensajesEnviados.sort((a, b) => b.timestamp - a.timestamp);
      if (mensajesEnviados.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No has enviado mensajes</p>';
        return;
      }
      let html = '';
      mensajesEnviados.forEach(msg => {
        const usernameSafe = msg.username.replace(/"/g, '&quot;');
        html += `
          <div class="mensaje-item">
            <div class="mensaje-header" onclick="this.parentNode.classList.toggle('abierto')">
              <span>📤 ${msg.fecha} · Para: ${usernameSafe}</span>
              <span class="flecha">▼</span>
            </div>
            <div class="mensaje-contenido">${msg.texto}</div>
          </div>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Error cargando mensajes enviados admin:', error);
      container.innerHTML = '<p style="color:var(--zone-5);">Error al cargar</p>';
    }
  },

  async borrarMensajeUsuario(uid, idx, esRecibido = true) {
    const confirmed = await Utils.confirm('Eliminar mensaje', '¿Eliminar este mensaje?');
    if (!confirmed) return;
    try {
      await Storage.borrarMensajeUsuario(uid, idx);
      Utils.showToast('✅ Mensaje eliminado', 'success');
      if (esRecibido) await this.cargarMensajesRecibidosAdmin();
      else await this.cargarMensajesEnviadosAdmin();
    } catch (error) {
      console.error('Error borrando mensaje:', error);
      Utils.showToast('Error al eliminar', 'error');
    }
  },

  async enviarMensajeRapido(uid, username) {
    const texto = prompt(`Escribe un mensaje para ${username}:`);
    if (!texto) return;
    try {
      await Storage.enviarMensajeAdminAUsuario(uid, texto);
      Utils.showToast('✅ Mensaje enviado', 'success');
      await this.cargarMensajesEnviadosAdmin();
    } catch (error) {
      console.error('Error enviando mensaje rápido:', error);
      Utils.showToast('Error al enviar', 'error');
    }
  },

  cambiarSoporteTab(tab) {
    document.querySelectorAll('#admin-tab-soporte .soporte-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#admin-tab-soporte .soporte-panel').forEach(p => p.classList.remove('active'));
    if (tab === 'recibidos') {
      document.querySelectorAll('#admin-tab-soporte .soporte-tab')[0]?.classList.add('active');
      document.getElementById('admin-soporte-recibidos')?.classList.add('active');
    } else {
      document.querySelectorAll('#admin-tab-soporte .soporte-tab')[1]?.classList.add('active');
      document.getElementById('admin-soporte-enviados')?.classList.add('active');
    }
  }
};

// ==================== FUNCIONES GLOBALES ====================
window.abrirModalUsuarios = (filtro) => Admin.abrirModalUsuarios(filtro);
window.abrirModalPendientes = () => Admin.abrirModalPendientes();
window.exportarUsuariosCSV = () => Admin.exportarUsuariosCSV();
window.renovarExpirados = () => Admin.renovarExpirados();
window.cambiarAdminSoporteTab = (tab) => Admin.cambiarSoporteTab(tab);
window.enviarMensajeAdmin = () => Admin.enviarMensajeAdmin();
window.switchAdminTab = function(tab) {
  document.querySelectorAll('#adminPage .tab-button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#adminPage .tab-content').forEach(c => c.classList.remove('active'));
  if(tab === 'usuarios') {
    document.querySelectorAll('#adminPage .tab-button')[0]?.classList.add('active');
    document.getElementById('admin-tab-usuarios')?.classList.add('active');
  } else {
    document.querySelectorAll('#adminPage .tab-button')[1]?.classList.add('active');
    document.getElementById('admin-tab-soporte')?.classList.add('active');
  }
};

// Inicializar si la página de admin ya está visible
if (document.getElementById('adminPage') && document.getElementById('adminPage').style.display !== 'none') {
  setTimeout(() => Admin.init(), 500);
}