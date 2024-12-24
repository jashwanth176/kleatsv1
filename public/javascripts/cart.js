let cart = [];
let debounceTimers = {};
let subtotal = 0;
const PICKUP_CHARGE = 5;

function addToCart(itemId, itemName, itemPrice) {
    const existingItem = cart.find(item => item.item_id === itemId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ item_id: itemId, item_name: itemName, price: itemPrice, quantity: 1 });
    }
    
    // Remove incrementCartCount() since updateCartDisplay() already handles this
    updateCartDisplay();
    updateButtonState(itemId);

    // Clear any existing timer for this button
    if (debounceTimers[itemId]) {
        clearTimeout(debounceTimers[itemId]);
    }

    // Change the button text and style
    const button = document.getElementById(`btn${itemId}`);
    button.innerHTML = 'Added';
    button.classList.add('added');
    button.disabled = true;

    // Set a new timer
    debounceTimers[itemId] = setTimeout(() => {
        button.innerHTML = '<i class="uil uil-plus"></i>';
        button.classList.remove('added');
        button.disabled = false;
        delete debounceTimers[itemId];
    }, 2500);
}

function updateCartDisplay() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById("cart-number-count").innerHTML = cartCount;
    updateTotalWithCharges();
}

function updateButtonState(itemId) {
    //flashButton(itemId);
    const button = document.getElementById(`btn${itemId}`);
    button.innerHTML = "Added";
    button.disabled = true;
}

function openMyCart() {
    const queryParams = new URLSearchParams({
        cart: JSON.stringify(cart)
    }).toString();
    
    window.location.href = `/cart?${queryParams}`;
}

// Initialize cart from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize empty cart
    cart = [];
    updateCartDisplay();
    updateTotalWithCharges();
});

// Save cart to localStorage whenever it changes
function saveCartToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}


// New function to flash button red
function flashButton(itemId) {
    const button = document.getElementById(`btn${itemId}`);
    button.style.transition = 'background-color 0.2s';
    button.style.backgroundColor = 'red';
    setTimeout(() => {
        button.style.backgroundColor = '';
    }, 1000);
}

function updateTotalWithCharges() {
    const orderType = document.getElementById('orderType').value;
    const subtotalElement = document.getElementById('subtotal');
    const pickupChargeElement = document.getElementById('pickupCharge');
    const totalElement = document.getElementById('total');
    
    // Calculate subtotal from cart items
    subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Calculate total quantity for pickup charge
    const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
    
    // Add pickup charge if applicable (₹5 per item)
    const pickupCharge = orderType === 'pickup' ? (5 * totalQuantity) : 0;
    
    // Update display elements
    subtotalElement.textContent = subtotal.toFixed(2);
    pickupChargeElement.textContent = pickupCharge.toFixed(2);
    
    // Update total
    const total = subtotal + pickupCharge;
    totalElement.textContent = total.toFixed(2);
}

// Modify the existing checkout function
async function checkout() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const orderType = document.getElementById('orderType').value;
    
    console.log('Checkout Debug:', {
        orderType: orderType,
        selectElement: document.getElementById('orderType'),
        selectedIndex: document.getElementById('orderType').selectedIndex
    });
    
    const requestBody = {
        name,
        phone,
        email,
        items: cart,
        order_time: getCurrentTime(),
        orderType
    };
    
    console.log('Request Body:', requestBody);
    
    try {
        const response = await fetch('/api/buyNow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        console.log('Checkout Response:', result);
        
        if (result.code === 1) {
            window.location.href = result.data.payment_link;
        } else {
            alert(result.message || 'Error processing order');
        }
    } catch (error) {
        console.error('Checkout Error:', error);
        alert('Error processing order');
    }
}
