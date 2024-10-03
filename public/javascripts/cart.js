let cart = [];

function addToCart(itemId, itemName, itemPrice) {
    const existingItem = cart.find(item => item.item_id === itemId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ item_id: itemId, item_name: itemName, price: itemPrice, quantity: 1 });
    }
    
    updateCartDisplay();
    updateButtonState(itemId);
}

function updateCartDisplay() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById("cart-number-count").innerHTML = cartCount;
}

function updateButtonState(itemId) {
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
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
        cart.forEach(item => updateButtonState(item.item_id));
    }
});

// Save cart to localStorage whenever it changes
function saveCartToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}
