const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("shopease.db");
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true, sameSite:"lax", maxAge:7*24*60*60*1000}
}));
app.use(express.static(path.join(__dirname,"public")));

db.exec(`
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, brand TEXT,
 description TEXT, price REAL NOT NULL, sale_price REAL, stock INTEGER DEFAULT 0,
 image TEXT, rating REAL DEFAULT 4.5, reviews INTEGER DEFAULT 0,
 featured INTEGER DEFAULT 0, bestseller INTEGER DEFAULT 0, newarrival INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT, phone TEXT, email TEXT,
 address TEXT, city TEXT, area TEXT, postal TEXT, notes TEXT, payment TEXT,
 subtotal REAL, delivery REAL, discount REAL, total REAL, status TEXT DEFAULT 'Order Placed',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER,
 name TEXT, price REAL, qty INTEGER
);
`);

const count = db.prepare("SELECT COUNT(*) c FROM products").get().c;
if (!count) {
  const ins = db.prepare(`INSERT INTO products
  (name,category,brand,description,price,sale_price,stock,image,rating,reviews,featured,bestseller,newarrival)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const seed = [
    ["Wireless Headphones","Electronics","SoundMax","Premium wireless headphones with deep bass and long battery life.",5999,4499,25,"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",4.7,128,1,1,1],
    ["Smart Watch Pro","Gadgets","TechFit","Modern smartwatch with health, notification and fitness features.",8999,6999,18,"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80",4.6,94,1,1,1],
    ["Classic Sneakers","Shoes","UrbanStep","Comfortable everyday sneakers with a clean modern design.",7499,5799,32,"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",4.5,77,1,0,1],
    ["Minimal Backpack","Fashion","CarryPro","Water-resistant backpack for school, travel and everyday use.",4999,3499,40,"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",4.4,51,0,1,1],
    ["Coffee Maker","Home & Kitchen","HomeBrew","Compact coffee maker for a quick cup at home.",9999,7999,12,"https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=700&q=80",4.8,43,1,1,0],
    ["Phone Case","Accessories","CaseLab","Shock-resistant premium phone case.",1999,1299,70,"https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=700&q=80",4.3,36,0,0,1]
  ];
  const tx=db.transaction(()=>seed.forEach(x=>ins.run(...x))); tx();
}

app.get("/api/products",(req,res)=>{
  const {q="",category="",sort="featured"}=req.query;
  let sql="SELECT * FROM products WHERE 1=1"; const p=[];
  if(q){sql+=" AND (name LIKE ? OR category LIKE ? OR brand LIKE ?)"; const x=`%${q}%`;p.push(x,x,x)}
  if(category && category!=="All"){sql+=" AND category=?";p.push(category)}
  const sorts={featured:"featured DESC",newest:"id DESC",low:"COALESCE(sale_price,price) ASC",high:"COALESCE(sale_price,price) DESC",rating:"rating DESC",popular:"reviews DESC"};
  sql+=" ORDER BY "+(sorts[sort]||sorts.featured);
  res.json(db.prepare(sql).all(...p));
});
app.get("/api/products/:id",(req,res)=>{
  const p=db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if(!p)return res.status(404).json({error:"Product not found"}); res.json(p);
});
app.post("/api/orders",(req,res)=>{
  const {customer,items,payment}=req.body;
  if(!customer?.name||!customer?.phone||!customer?.address||!items?.length)return res.status(400).json({error:"Missing order information"});
  let subtotal=0; const checked=[];
  for(const item of items){
    const p=db.prepare("SELECT * FROM products WHERE id=?").get(item.id);
    if(!p || p.stock < item.qty)return res.status(400).json({error:`Product unavailable: ${p?.name||item.id}`});
    const price=p.sale_price||p.price; subtotal+=price*item.qty; checked.push({p,qty:item.qty,price});
  }
  const delivery=subtotal>=10000?0:250, discount=0,total=subtotal+delivery-discount;
  const order=db.prepare(`INSERT INTO orders
  (customer_name,phone,email,address,city,area,postal,notes,payment,subtotal,delivery,discount,total)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(customer.name,customer.phone,customer.email||"",customer.address,customer.city||"",customer.area||"",customer.postal||"",customer.notes||"",payment||"Cash on Delivery",subtotal,delivery,discount,total);
  const ins=db.prepare("INSERT INTO order_items(order_id,product_id,name,price,qty) VALUES(?,?,?,?,?)");
  const dec=db.prepare("UPDATE products SET stock=stock-? WHERE id=?");
  const tx=db.transaction(()=>checked.forEach(x=>{ins.run(order.lastInsertRowid,x.p.id,x.p.name,x.price,x.qty);dec.run(x.qty,x.p.id)})); tx();
  res.json({success:true,orderId:order.lastInsertRowid,total});
});
app.get("/api/orders/:id",(req,res)=>{
  const order=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if(!order)return res.status(404).json({error:"Order not found"});
  order.items=db.prepare("SELECT * FROM order_items WHERE order_id=?").all(req.params.id); res.json(order);
});
app.get("/api/admin/stats",(req,res)=>{
  const sales=db.prepare("SELECT COALESCE(SUM(total),0) x FROM orders WHERE status!='Cancelled'").get().x;
  res.json({
    sales, orders:db.prepare("SELECT COUNT(*) c FROM orders").get().c,
    products:db.prepare("SELECT COUNT(*) c FROM products").get().c,
    customers:db.prepare("SELECT COUNT(DISTINCT phone) c FROM orders").get().c,
    pending:db.prepare("SELECT COUNT(*) c FROM orders WHERE status NOT IN ('Delivered','Cancelled')").get().c,
    completed:db.prepare("SELECT COUNT(*) c FROM orders WHERE status='Delivered'").get().c,
    lowStock:db.prepare("SELECT COUNT(*) c FROM products WHERE stock<10").get().c
  });
});
app.get("/api/admin/orders",(req,res)=>res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all()));
app.put("/api/admin/orders/:id",(req,res)=>{
  const allowed=["Order Placed","Order Confirmed","Processing","Shipped","Out for Delivery","Delivered","Cancelled"];
  if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid status"});
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);res.json({success:true});
});
app.post("/api/admin/products",(req,res)=>{
  const x=req.body;
  const r=db.prepare(`INSERT INTO products(name,category,brand,description,price,sale_price,stock,image,rating,reviews,featured,bestseller,newarrival)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.name,x.category||"Other",x.brand||"",x.description||"",+x.price||0,+x.sale_price||null,+x.stock||0,x.image||"",+x.rating||4.5,+x.reviews||0,+!!x.featured,+!!x.bestseller,+!!x.newarrival);
  res.json({id:r.lastInsertRowid});
});
app.delete("/api/admin/products/:id",(req,res)=>{db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);res.json({success:true})});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`ShopEase running at http://localhost:${PORT}`));
