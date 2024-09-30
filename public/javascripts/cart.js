let item_count = 0;
let cart = [];

function addToCart(item_id) {
  item_count++;
  document.getElementById("cart-number-count").innerHTML = item_count;
  const name = "btn" + item_id;
  document.getElementById(name).disabled = true;
  document.getElementById(name).innerHTML = "Added";
  
  // Check if item already exists in cart
  const existingItem = cart.find(item => item.item_id === item_id);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ item_id: item_id, quantity: 1 });
  }

  console.log('Updated cart:', cart); // Add this line for debugging
}

function openMyCart() {
  const queryParams = new URLSearchParams({
    cart: JSON.stringify(cart),
    item_count: item_count
  }).toString();
  
  window.location.href = `/cart?${queryParams}`;
}

// Add this function to update the hidden input before form submission
function updateCartData() {
  const quantities = document.querySelectorAll('.quantity');
  const updatedCart = [];
  
  quantities.forEach((quantityInput, index) => {
    updatedCart.push({
      item_id: cart[index].item_id,
      quantity: parseInt(quantityInput.value)
    });
  });
  
  document.getElementById('cartData').value = JSON.stringify(updatedCart);
}
