// ============================================
// LÓGICA DEL CLIENTE
// ============================================
const urlParams = new URLSearchParams(window.location.search);
const tableId = parseInt(urlParams.get('table')) || 1;
const restaurantId = parseInt(urlParams.get('restaurant')) || 1;
const customerName = urlParams.get('name') || 'Cliente Invitado';

let cart = [];
let currentCategory = 'Pizzas Tradicionales';

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('table-info').innerText = `Mesa ${tableId} - ${customerName}`;
    loadMenu(currentCategory);
});

// ============================================
// CARGAR MENÚ
// ============================================
async function loadMenu(category) {
    currentCategory = category;
    const container = document.getElementById('menu-container');
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Cargando...</p>';

    const { data, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('category', category)
        .eq('is_available', true);

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

// ============================================
// FILTRAR CATEGORÍA
// ============================================
function filterMenu(category, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMenu(category);
}

// ============================================
// CARRITO
// ============================================
function addToCart(id, name, price) {
    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartBadge();
    showToast(`✅ ${name} agregado`);
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (totalItems > 0) {
        badge.classList.add('visible');
        badge.innerText = totalItems;
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
                    <small>${i.quantity} x $${Number(i.price).toLocaleString('es-AR')}</small>
                </div>
                <div>
                    <strong>$${(i.price * i.quantity).toLocaleString('es-AR')}</strong>
                </div>
            </div>
        `).join('');
    }

    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    totalEl.innerText = `$${total.toLocaleString('es-AR')}`;
    modal.classList.add('active');
}

function closeCart() {
    document.getElementById('cart-modal').classList.remove('active');
}

// ============================================
// CONFIRMAR PEDIDO
// ============================================
async function confirmOrder() {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    const paymentMethod = document.getElementById('payment-method').value;
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // 1. Insertar pedido principal
    const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert({
            restaurant_id: restaurantId,
            table_id: tableId,
            customer_name: customerName,
            payment_method: paymentMethod,
            status: 'Pendiente',
            total: total
        })
        .select()
        .single();

    if (orderError) {
        alert('Error al crear pedido: ' + orderError.message);
        return;
    }

    // 2. Insertar items del pedido
    const items = cart.map(i => ({
        order_id: orderData.id,
        menu_item_id: i.id,
        item_name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
        status: 'Pendiente'
    }));

    const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(items);

    if (itemsError) {
        alert('Error al agregar items: ' + itemsError.message);
        return;
    }

    // 3. Éxito
    cart = [];
    updateCartBadge();
    closeCart();
    document.getElementById('success-modal').classList.add('active');
}

function closeSuccess() {
    document.getElementById('success-modal').classList.remove('active');
}

// ============================================
// NOTIFICAR AL MOZO
// ============================================
async function callWaiter(action) {
    const message = action === 'call' ? 'Mozo solicitado' : 'Cuenta solicitada';
    await supabaseClient
        .from('notifications')
        .insert({
            restaurant_id: restaurantId,
            table_id: tableId,
            type: action,
            message: message
        });
    showToast(`🔔 ${message}`);
}

// ============================================
// TOAST (notificación breve)
// ============================================
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%);
        background: #333; color: white; padding: 10px 20px; border-radius: 20px;
        font-size: 14px; z-index: 999; animation: fadeIn 0.3s;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
