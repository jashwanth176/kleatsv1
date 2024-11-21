let cart = [];
let debounceTimers = {};

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
