const state={products:[],cart:JSON.parse(localStorage.getItem("shopease-cart")||"[]")};
const cats=[["📱","Mobile Phones"],["💻","Electronics"],["🎧","Accessories"],["👟","Shoes"],["⌚","Watches"],["🏠","Home & Kitchen"],["💄","Beauty"],["⚽","Sports"],["🧸","Kids"],["🎒","Fashion"],["🔌","Gadgets"],["📦","Other"]];

document.addEventListener("DOMContentLoaded",()=>{renderCategories();loadProducts();renderCart();loadAdmin();});

function renderCategories(){categoryList.innerHTML=cats.map(c=>`<button class="cat" onclick="filterCat('${c[1]}')"><div>${c[0]}</div><b>${c[1]}</b></button>`).join("")}
function filterCat(c){document.querySelector("#search").value="";loadProducts(c)}
async function loadProducts(category=""){
  const q=encodeURIComponent(document.querySelector("#search")?.value||"");
  const sort=document.querySelector("#sort")?.value||"featured";
  const r=await fetch(`/api/products?q=${q}&category=${encodeURIComponent(category)}&sort=${sort}`);state.products=await r.json();
  products.innerHTML=state.products.length?state.products.map(productCard).join(""):`<p>No products found.</p>`;
}
function productCard(p){
 const price=p.sale_price||p.price, discount=p.sale_price?Math.round((1-p.sale_price/p.price)*100):0;
 return `<article class="product"><span class="badge">${discount?discount+"% OFF":(p.newarrival?"NEW":"")}</span>
 <img loading="lazy" src="${p.image}" alt="${esc(p.name)}"><div class="pbody"><h3>${esc(p.name)}</h3><div class="desc">${esc(p.description||"Quality product")}</div>
 <div class="rating">★ ${p.rating} · ${p.reviews} reviews</div><div><span class="price">Rs. ${money(price)}</span>${p.sale_price?`<span class="old">Rs. ${money(p.price)}</span>`:""}</div>
 <div class="pactions"><button onclick="addCart(${p.id})">Add to Cart</button><button class="buy" onclick="buyNow(${p.id})">Buy Now</button></div></div></article>`
}
function addCart(id){const p=state.products.find(x=>x.id===id);const x=state.cart.find(x=>x.id===id);x?x.qty++:state.cart.push({id,qty:1});saveCart();toast(`${p?.name||"Product"} added to cart`)}
function buyNow(id){addCart(id);checkout()}
function saveCart(){localStorage.setItem("shopease-cart",JSON.stringify(state.cart));renderCart()}
async function renderCart(){
 let html="",total=0,count=0;
 for(const x of state.cart){const p=await getProduct(x.id);if(!p)continue;const price=p.sale_price||p.price;total+=price*x.qty;count+=x.qty;
 html+=`<div class="cart-row"><img src="${p.image}" alt=""><div><b>${esc(p.name)}</b><div>Rs. ${money(price)}</div><div class="qty"><button onclick="changeQty(${p.id},-1)">−</button> ${x.qty} <button onclick="changeQty(${p.id},1)">+</button></div></div><button onclick="removeCart(${p.id})">🗑</button></div>`}
 cartItems.innerHTML=html||"<p>Your cart is empty.</p>";cartTotal.textContent=`Rs. ${money(total)}`;cartCount.textContent=count;
}
async function getProduct(id){return state.products.find(p=>p.id===id)||fetch(`/api/products/${id}`).then(r=>r.ok?r.json():null)}
function changeQty(id,n){const x=state.cart.find(x=>x.id===id);if(x){x.qty+=n;if(x.qty<=0)state.cart=state.cart.filter(x=>x.id!==id);saveCart()}}
function removeCart(id){state.cart=state.cart.filter(x=>x.id!==id);saveCart();toast("Removed from cart")}
function toggleCart(){cart.classList.toggle("open")}
async function checkout(){
 if(!state.cart.length)return toast("Your cart is empty");
 const rows=await Promise.all(state.cart.map(async x=>{const p=await getProduct(x.id);return {p,x}}));
 const subtotal=rows.reduce((s,o)=>s+(o.p.sale_price||o.p.price)*o.x.qty,0),delivery=subtotal>=10000?0:250;
 modalBox.innerHTML=`<h2>Checkout</h2><p>Subtotal: <b>Rs. ${money(subtotal)}</b> · Delivery: <b>Rs. ${money(delivery)}</b></p>
 <form onsubmit="placeOrder(event)"><input name="name" required placeholder="Full Name"><input name="phone" required placeholder="Mobile Number"><input name="email" type="email" placeholder="Email"><input name="address" required placeholder="Complete Address"><input name="city" placeholder="City"><input name="area" placeholder="Area"><input name="postal" placeholder="Postal Code"><textarea name="notes" placeholder="Order Notes"></textarea><select name="payment"><option>Cash on Delivery</option><option>Bank Transfer</option><option>Online Payment</option></select><button class="btn">Place Order — Rs. ${money(subtotal+delivery)}</button></form>`;
 modal.classList.add("show");
}
async function placeOrder(e){
 e.preventDefault();const f=new FormData(e.target);const customer=Object.fromEntries(f.entries());
 const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer,items:state.cart,payment:customer.payment})});const data=await r.json();
 if(!r.ok)return toast(data.error||"Order failed");
 state.cart=[];saveCart();toggleCart();showOrder(data.orderId);
}
async function showOrder(id){
 const r=await fetch(`/api/orders/${id}`),o=await r.json();
 modalBox.innerHTML=`<div class="success"><h2>🎉 Order Placed</h2><p>Order #${o.id}</p><p>Total: <b>Rs. ${money(o.total)}</b></p><div class="timeline">${["Order Placed","Order Confirmed","Processing","Shipped","Out for Delivery","Delivered"].map((x,i)=>`<div class="${i===0?"active":""}">${x}</div>`).join("")}</div><p>We will contact you on <b>${esc(o.phone)}</b> for confirmation.</p><button class="btn" onclick="closeModal()">Continue Shopping</button></div>`;
 modal.classList.add("show");
}
function closeModal(){modal.classList.remove("show")}
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
async function loadAdmin(){
 const s=await fetch("/api/admin/stats").then(r=>r.json());
 stats.innerHTML=[["Sales","Rs. "+money(s.sales)],["Orders",s.orders],["Customers",s.customers],["Products",s.products],["Pending",s.pending],["Completed",s.completed],["Low Stock",s.lowStock]].map(x=>`<div class="stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("");
 const os=await fetch("/api/admin/orders").then(r=>r.json());
 orders.innerHTML=os.slice(0,10).map(o=>`<div class="order"><b>#${o.id}</b> ${esc(o.customer_name)} · Rs. ${money(o.total)} <select onchange="updateOrder(${o.id},this.value)">${["Order Placed","Order Confirmed","Processing","Shipped","Out for Delivery","Delivered","Cancelled"].map(x=>`<option ${x===o.status?"selected":""}>${x}</option>`).join("")}</select></div>`).join("")||"<p>No orders yet.</p>";
}
async function updateOrder(id,status){await fetch(`/api/admin/orders/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});toast("Order status updated");loadAdmin()}
productForm.addEventListener("submit",async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));await fetch("/api/admin/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(x)});e.target.reset();toast("Product added");loadProducts();loadAdmin()});
function money(n){return Number(n||0).toLocaleString("en-PK")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(t){const x=document.querySelector("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
