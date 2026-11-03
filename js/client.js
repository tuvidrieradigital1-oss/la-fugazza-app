// ============================================
// LÓGICA DEL CLIENTE
// ============================================
const urlParams = new URLSearchParams(window.location.search);
const tableId = parseInt(urlParams.get('table')) || 1;
const restaurantId = parseInt(urlParams.get('restaurant')) || 1;
const customerName = urlParams.get('name') || 'Cliente Invitado';

let cart = [];
let currentCategory = 'Pizzas Tradicionales';
let currentOrderId = null;
let timerInterval = null;
let targetTime = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('table-info').innerText = `Mesa ${tableId} - ${customerName}`;
    loadMenu(currentCategory);
    // Recuperar pedido si se recarga la página
    const savedOrderId = localStorage.getItem(`order_${tableId}`);
    if (savedOrderId) {
        currentOrderId = savedOrderId;
        showTrackingBadge();
        escucharEstadoPedido(savedOrderId);
    }
});

async function loadMenu(category) {
    currentCategory = category;
    const container = document.getElementById('menu-container');
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Cargando...</p>';

    const { data, error } = await supabaseClient
        .from('menu_items').select('*')
        .eq('restaurant_id', restaurantId).eq('category', category).eq('is_available', true);

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding: 20px;">No hay platos disponibles.</p>';
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="menu-item" onclick="addToCart(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">
            <img src="${item.image_url}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/400x200/FDF6E3/B22222?text=${encodeURIComponent(item.name)}'">
            <div class="menu-item-info">
                <h3>${item.name}</h3>
                <p>${item.description || ''}</p>
                <span class="price">$${Number(item.price).toLocaleString('es-AR')}</span>
            </div>
        </div>
    `).join('');
}

function filterMenu(category, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMenu(category);
}

// CARRITO EDITABLE
function addToCart(id, name, price) {
    const existing = cart.find(i => i.id === id);
    if (existing) { existing.quantity++; } else { cart.push({ id, name, price, quantity: 1 }); }
    updateCartBadge();
    showToast(`✅ ${name} agregado`);
}

function changeQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
        openCart(); // Refresca el modal
        updateCartBadge();
    }
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (totalItems > 0) {
        badge.classList.add('visible');
        badge.innerText = `Su pedido (${totalItems})`;
    } else {
        badge.classList.remove('visible');
    }
}

function openCart() {
    const modal = document.getElementById('cart-modal');
    const list = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-amount');

    if (cart.length === 0) {
        list.innerHTML = '<p class="empty-msg">Tu carrito está vacío</p>';
    } else {
        list.innerHTML = cart.map(i => `
            <div class="cart-item">
                <div>
                    <strong>${i.name}</strong><br>
                    <small>$${Number(i.price).toLocaleString('es-AR')} c/u</small>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-qty" onclick="changeQuantity(${i.id}, -1)">-</button>
                    <span>${i.quantity}</span>
                    <button class="btn-qty" onclick="changeQuantity(${i.id}, 1)">+</button>
                </div>
            </div>
        `).join('');
    }
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    totalEl.innerText = `$${total.toLocaleString('es-AR')}`;
    modal.classList.add('active');
}

function closeCart() { document.getElementById('cart-modal').classList.remove('active'); }

// CONFIRMAR PEDIDO
async function confirmOrder() {
    if (cart.length === 0) { alert('El carrito está vacío'); return; }
    const paymentMethod = document.getElementById('payment-method').value;
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const { data: orderData, error: orderError } = await supabaseClient
        .from('orders').insert({ restaurant_id: restaurantId, table_id: tableId, customer_name: customerName, payment_method: paymentMethod, status: 'Pendiente', total: total })
        .select().single();

    if (orderError) { alert('Error al crear pedido: ' + orderError.message); return; }

    const items = cart.map(i => ({ order_id: orderData.id, menu_item_id: i.id, item_name: i.name, quantity: i.quantity, unit_price: i.price, status: 'Pendiente' }));
    await supabaseClient.from('order_items').insert(items);

    currentOrderId = orderData.id;
    localStorage.setItem(`order_${tableId}`, currentOrderId); // Guardamos para que no se pierda si recarga

    cart = []; updateCartBadge(); closeCart();
    document.getElementById('success-modal').classList.add('active');
    
    showTrackingBadge();
    escucharEstadoPedido(orderData.id);
}

function closeSuccess() { document.getElementById('success-modal').classList.remove('active'); }

// --- SEGUIMIENTO Y TEMPORIZADOR ---
function showTrackingBadge() {
    document.getElementById('tracking-badge').classList.add('active');
}

function openTracking() {
    document.getElementById('tracking-panel').classList.add('active');
}

function closeTracking() {
    document.getElementById('tracking-panel').classList.remove('active');
}

function updateTrackingUI(status, estimatedMinutes, createdAt) {
    const statusEl = document.getElementById('tracking-status');
    const timerEl = document.getElementById('tracking-timer');
    
    statusEl.innerText = `Estado: ${status}`;

    if (status === 'Listo') {
        timerEl.innerText = "¡LISTO!";
        timerEl.style.color = "#1E7A46";
        statusEl.innerText = "¡Tu pedido está listo! El mozo lo está llevando.";
    } else if (status === 'Entregado') {
        timerEl.innerText = "Entregado";
        statusEl.innerText = "¡Buen provecho!";
    } else {
        // Calcular tiempo
        const orderTime = new Date(createdAt).getTime();
        targetTime = orderTime + (estimatedMinutes * 60000);
        startTimer();
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetTime - now;

        if (distance < 0) {
            document.getElementById('tracking-timer').innerText = "00:00";
            document.getElementById('tracking-timer').style.color = "#B22222";
            document.getElementById('tracking-status').innerText = "¡Demorando un poquito más!";
            clearInterval(timerInterval);
            return;
        }

        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById('tracking-timer').innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// ESCUCHAR CAMBIOS EN TIEMPO REAL
function escucharEstadoPedido(orderId) {
    // Primero traemos los datos actuales para iniciar el timer
    supabaseClient.from('orders').select('*').eq('id', orderId).single().then(({data}) => {
        if(data) updateTrackingUI(data.status, data.estimated_minutes || 20, data.created_at);
    });

    supabaseClient
        .channel('cliente-' + orderId)
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, 
            (payload) => {
                const newStatus = payload.new.status;
                const newMinutes = payload.new.estimated_minutes;
                const createdAt = payload.new.created_at;
                
                updateTrackingUI(newStatus, newMinutes, createdAt);

                if (newStatus === 'Listo') {
                    const banner = document.createElement('div');
                    banner.className = 'order-ready-banner';
                    banner.innerHTML = '🚨 ¡Tu pedido está listo! 🚨<br><small>El mozo lo está llevando a tu mesa.</small>';
                    document.body.appendChild(banner);
                    banner.style.display = 'block';
                    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                    audio.play().catch(e => console.log("Audio bloqueado."));
                    setTimeout(() => banner.remove(), 10000);
                }
            }
        ).subscribe();
}

// NOTIFICAR AL MOZO
async function callWaiter(action) {
    const message = action === 'call' ? 'Mozo solicitado' : 'Cuenta solicitada';
    await supabaseClient.from('notifications').insert({ restaurant_id: restaurantId, table_id: tableId, type: action, message: message });
    showToast(`🔔 ${message}`);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 10px 20px; border-radius: 20px; font-size: 14px; z-index: 999;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
