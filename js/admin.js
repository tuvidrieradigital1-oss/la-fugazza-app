// ============================================
// LÓGICA DEL ADMIN
// ============================================
let currentRestaurantId = 1;
let realtimeChannel = null;
let notificationsChannel = null;

function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if (email === 'tuvidrieradigital1@gmail.com' && pass === 'clave1234') {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        initAdmin();
    } else { alert('Credenciales incorrectas'); }
}

function logout() {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    if (notificationsChannel) supabaseClient.removeChannel(notificationsChannel);
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

function initAdmin() {
    loadOrders();
    subscribeToOrders();
    subscribeToNotifications(); 
}

// --- SISTEMA DE NOTIFICACIONES VISUALES ---
function addAlertToUI(text) {
    const container = document.getElementById('admin-alerts-container');
    const list = document.getElementById('admin-alerts-list');
    
    container.style.display = 'block'; 
    
    const alertDiv = document.createElement('div');
    // Forzamos los estilos con un borde rojo y fondo blanco
    alertDiv.style.border = "1px solid #ccc";
    alertDiv.style.background = "white";
    alertDiv.style.padding = "10px";
    alertDiv.style.marginBottom = "5px";
    alertDiv.style.borderLeft = "4px solid #B22222";
    alertDiv.style.color = "black"; // Texto negro garantizado
    alertDiv.style.fontWeight = "bold";
    
    alertDiv.innerText = `🔔 ${text}`;
    list.appendChild(alertDiv);

    setTimeout(() => {
        if(alertDiv.parentNode) alertDiv.parentNode.removeChild(alertDiv);
        if(list.children.length === 0) container.style.display = 'none';
    }, 120000);
}

    setTimeout(() => {
        if(alertDiv.parentNode) alertDiv.parentNode.removeChild(alertDiv);
        if(list.children.length === 0) container.style.display = 'none';
    }, 120000);
}

function clearAlerts() {
    document.getElementById('admin-alerts-list').innerHTML = '';
    document.getElementById('admin-alerts-container').style.display = 'none';
}

function subscribeToNotifications() {
    // Si ya había un canal abierto, lo cerramos para no duplicar
    if (notificationsChannel) supabaseClient.removeChannel(notificationsChannel);

    notificationsChannel = supabaseClient.channel('notificaciones-mozo')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
            console.log("¡Notificación recibida!", payload); // Para debug en consola
            if (payload.new.restaurant_id == currentRestaurantId) {
                
                // 1. Sonido de alerta
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log("El navegador bloqueó el audio hasta que hagas clic en la pantalla."));
                
                // 2. Mostrar en pantalla
                const mensaje = `${payload.new.message} en la Mesa ${payload.new.table_id}`;
                addAlertToUI(mensaje);
            }
        }).subscribe((status) => {
            console.log("Estado de conexión de notificaciones:", status);
        });
}

// --- PEDIDOS ---
async function loadOrders() {
    const { data, error } = await supabaseClient
        .from('orders').select(`*, order_items (*)`)
        .eq('restaurant_id', currentRestaurantId)
        .order('created_at', { ascending: false });

    const container = document.getElementById('orders-list');
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="empty-msg">No hay pedidos aún</p>';
        return;
    }

    container.innerHTML = data.map(order => `
        <div class="card order-card ${order.status === 'Listo' ? 'ready' : ''}">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <h3 style="margin: 0;">Mesa ${order.table_id} - ${order.customer_name}</h3>
                    <small style="color: #666;">${new Date(order.created_at).toLocaleString('es-AR')} · ${order.payment_method}</small>
                    <br>
                    <small style="color: #B22222; font-weight: bold;">⏱ Tiempo: ${order.estimated_minutes || 20} min</small>
                </div>
                <strong style="color: #B22222;">$${Number(order.total).toLocaleString('es-AR')}</strong>
            </div>
            <ul style="margin: 10px 0; padding-left: 20px;">
                ${order.order_items.map(i => `<li>${i.quantity}x ${i.item_name} - <em>${i.status}</em></li>`).join('')}
            </ul>
            <div style="margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    ${order.status === 'Pendiente' ? `<button class="btn-status btn-cook" onclick="updateOrderStatus(${order.id}, 'En Cocina')">▶ En Cocina</button>` : ''}
                    ${order.status === 'En Cocina' ? `<button class="btn-status btn-ready" onclick="updateOrderStatus(${order.id}, 'Listo')">✅ Listo</button>` : ''}
                    ${order.status === 'Listo' ? `<button class="btn-status btn-deliver" onclick="updateOrderStatus(${order.id}, 'Entregado')">📦 Entregado</button>` : ''}
                </div>
                <div>
                    <span style="font-size: 12px; color: #666;">Modificar tiempo:</span>
                    <input type="number" value="${order.estimated_minutes || 20}" style="width: 50px; padding: 2px;" onchange="updateEstimatedTime(${order.id}, this.value)"> min
                </div>
            </div>
            <div style="text-align: right; margin-top: 5px;">
                 <span style="font-size: 12px; padding: 6px; background: #eee; border-radius: 6px;">Estado: <strong>${order.status}</strong></span>
            </div>
        </div>
    `).join('');
}

async function updateEstimatedTime(orderId, minutes) {
    await supabaseClient.from('orders').update({ estimated_minutes: parseInt(minutes) }).eq('id', orderId);
    loadOrders();
}

async function updateOrderStatus(orderId, newStatus) {
    await supabaseClient.from('orders').update({ status: newStatus }).eq('id', orderId);
    loadOrders();
}

function subscribeToOrders() {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient.channel('orders-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => { loadOrders(); })
        .subscribe();
}

// --- MESAS Y RANKING ---
async function loadTables() {
    const { data, error } = await supabaseClient.from('orders').select(`*, order_items (*)`).eq('restaurant_id', currentRestaurantId).neq('status', 'Entregado');
    const container = document.getElementById('tables-list');
    if (error || !data || data.length === 0) { container.innerHTML = '<p class="empty-msg">No hay mesas activas</p>'; return; }
    const grouped = {};
    data.forEach(o => { if (!grouped[o.table_id]) grouped[o.table_id] = []; grouped[o.table_id].push(o); });
    container.innerHTML = Object.keys(grouped).map(tableId => {
        const orders = grouped[tableId];
        const totalTable = orders.reduce((sum, o) => sum + Number(o.total), 0);
        const personas = orders.length;
        const perPerson = totalTable / personas;
        return `
            <div class="card">
                <h3>🪑 Mesa ${tableId}</h3>
                ${orders.map(o => `
                    <div class="table-group">
                        <div><strong>${o.customer_name}</strong><ul style="margin: 5px 0; padding-left: 18px; font-size: 13px;">${o.order_items.map(i => `<li>${i.quantity}x ${i.item_name}</li>`).join('')}</ul></div>
                        <div style="text-align: right;"><span>$${Number(o.total).toLocaleString('es-AR')}</span></div>
                    </div>
                `).join('')}
                <div class="table-group" style="border-top: 2px solid #B22222; padding-top: 12px;">
                    <div><strong>Total Mesa:</strong> <span class="table-total">$${totalTable.toLocaleString('es-AR')}</span></div>
                    <div><strong>Por Persona:</strong> $${perPerson.toLocaleString('es-AR')}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadRanking() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data, error } = await supabaseClient.from('order_items').select('item_name, quantity, orders!inner(created_at, restaurant_id)').eq('orders.restaurant_id', currentRestaurantId).gte('orders.created_at', startOfMonth);
    if (error || !data) { document.getElementById('ranking-list').innerHTML = '<p class="empty-msg">Sin datos</p>'; return; }
    const counts = {};
    data.forEach(i => { counts[i.item_name] = (counts[i.item_name] || 0) + i.quantity; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    document.getElementById('ranking-list').innerHTML = sorted.length === 0 ? '<p class="empty-msg">Sin pedidos este mes</p>' : sorted.map(([name, qty], idx) => `
        <div class="table-group"><div><strong>${idx + 1}.</strong> ${name}</div><div><strong>${qty}</strong> pedidos</div></div>
    `).join('');
}
