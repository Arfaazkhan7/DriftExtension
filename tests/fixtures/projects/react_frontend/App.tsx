import React, { useState } from 'react';

export function ProductCatalog({ products, onAddToCart }) {
  return (
    <div className="product-list">
      {products.map(p => (
        <div key={p.id} className="card">
          <h3>{p.name}</h3>
          <span>${p.price}</span>
          <button onClick={() => onAddToCart(p)}>Add to Cart</button>
        </div>
      ))}
    </div>
  );
}

export function ShoppingCart({ cartItems, onCheckout }) {
  const total = cartItems.reduce((acc, item) => acc + item.price, 0);
  return (
    <div className="cart-summary">
      <h2>Shopping Cart</h2>
      <p>Total items: {cartItems.length}</p>
      <p>Total amount: ${total}</p>
      <button onClick={onCheckout}>Proceed to Checkout</button>
    </div>
  );
}
