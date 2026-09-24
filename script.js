/* BOOKLY 2.0
   - Favorites persisted in localStorage
   - 10,000+ catalog via paginated Open Library Search API (loads in pages, not all at once)
   - Cover fallback chain: cover_i -> ISBN -> generated local cover
   - Checkout + order confirmation demo
   - Support center / FAQ / policies
   - Every book gets a unique BOOKLY story hook generated from its metadata
*/

const SEED_BOOKS = [
  {id:1,name:'Marketing 5.0',author:'Philip Kotler',cat:'Marketing',price:149000,isbn:'9781119668510',tag:'BÁN CHẠY'},
  {id:2,name:'Atomic Habits',author:'James Clear',cat:'Kỹ năng',price:149000,isbn:'9780735211292',tag:'BÁN CHẠY'},
  {id:3,name:'The Psychology of Money',author:'Morgan Housel',cat:'Kinh tế',price:129000,isbn:'9780857197689'},
  {id:4,name:'The Alchemist',author:'Paulo Coelho',cat:'Văn học',price:139000,isbn:'9780062315007'},
  {id:5,name:'1984',author:'George Orwell',cat:'Văn học',price:119000,isbn:'9780451524935'},
  {id:6,name:'Thinking, Fast and Slow',author:'Daniel Kahneman',cat:'Tâm lý',price:159000,isbn:'9780374533557'},
  {id:7,name:'English Grammar in Use',author:'Raymond Murphy',cat:'Ngoại ngữ',price:129000,isbn:'9781108457651'},
  {id:8,name:'A Brief History of Time',author:'Stephen Hawking',cat:'Khoa học',price:149000,isbn:'9780553380163'},
  {id:9,name:'Sapiens',author:'Yuval Noah Harari',cat:'Lịch sử',price:169000,isbn:'9780062316097'},
  {id:10,name:'Digital Marketing',author:'Simon Kingsnorth',cat:'Marketing',price:219000,isbn:'9780749493459'},
  {id:11,name:'How to Win Friends and Influence People',author:'Dale Carnegie',cat:'Kỹ năng',price:139000,isbn:'9780671027032'},
  {id:12,name:'The Intelligent Investor',author:'Benjamin Graham',cat:'Kinh tế',price:239000,isbn:'9780060555665'},
  {id:13,name:'Quiet',author:'Susan Cain',cat:'Tâm lý',price:159000,isbn:'9780307352156'},
  {id:14,name:'The Great Gatsby',author:'F. Scott Fitzgerald',cat:'Văn học',price:129000,isbn:'9780743273565'},
  {id:15,name:'The Art of War',author:'Sun Tzu',cat:'Lịch sử',price:99000,isbn:'9781590302255'},
  {id:16,name:'The Selfish Gene',author:'Richard Dawkins',cat:'Khoa học',price:179000,isbn:'9780199291151'},
  {id:17,name:'Word Power Made Easy',author:'Norman Lewis',cat:'Ngoại ngữ',price:99000,isbn:'9781101873854'},
  {id:18,name:'Blue Ocean Strategy',author:'W. Chan Kim',cat:'Kinh tế',price:149000,isbn:'9781625274496'},
  {id:19,name:'Influence',author:'Robert B. Cialdini',cat:'Marketing',price:189000,isbn:'9780061241895'},
  {id:20,name:'Man’s Search for Meaning',author:'Viktor E. Frankl',cat:'Tâm lý',price:109000,isbn:'9780807014271'}
];

const CATEGORY_QUERIES = [
  ['Văn học','fiction literature novels classics'],
  ['Kinh tế','business economics finance entrepreneurship management'],
  ['Marketing','marketing advertising branding digital marketing'],
  ['Kỹ năng','self help productivity personal development leadership'],
  ['Tâm lý','psychology cognitive science behavior sociology'],
  ['Ngoại ngữ','english language learning grammar vocabulary linguistics'],
  ['Khoa học','science technology mathematics physics biology medicine'],
  ['Lịch sử','history biography politics culture geography anthropology'],
  ['Thiếu nhi','children young adult picture books'],
  ['Nghệ thuật','art design photography music film architecture'],
  ['Công nghệ','computer programming software data artificial intelligence'],
  ['Triết học','philosophy ethics logic religion'],
  ['Du lịch','travel cooking food gardening lifestyle'],
  ['Giáo dục','education teaching pedagogy textbooks']
];

const promos = [
  {code:'BOOK5',title:'Giảm 5%',note:'Cho đơn từ 150.000đ'}, {code:'BOOK10',title:'Giảm 10%',note:'Cho đơn từ 250.000đ'},
  {code:'BOOK15',title:'Giảm 15%',note:'Cho đơn từ 350.000đ'}, {code:'BOOK20',title:'Giảm 20%',note:'Cho đơn từ 500.000đ'},
  {code:'WELCOME10',title:'Giảm 10%',note:'Khách hàng mới'}, {code:'NEWBOOK',title:'Giảm 12%',note:'Sách mới'},
  {code:'STUDENT',title:'Giảm 10%',note:'Ưu đãi sinh viên'}, {code:'READMORE',title:'Giảm 15%',note:'Đơn từ 400.000đ'},
  {code:'WEEKEND',title:'Giảm 20%',note:'Cuối tuần'}, {code:'FREESHIP',title:'Miễn phí vận chuyển',note:'Đơn từ 300.000đ'}
];

let books = [...SEED_BOOKS];
let filter = '';
let query = '';
let page = 1;
let loading = false;
let catalogExhausted = false;
let loadedKeys = new Set(SEED_BOOKS.map(b => b.name.toLowerCase()+b.author.toLowerCase()));
let cart = loadJSON('bookly_cart', {});
let favorites = new Set(loadJSON('bookly_favorites', []));
let checkoutState = {promo:null, customer:{}};

const money = n => Number(n||0).toLocaleString('vi-VN')+'đ';
const escapeHtml = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeId = key => 'ol_'+String(key||'').replace(/[^a-zA-Z0-9_-]/g,'_');
function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function coverCandidates(b){
  const a=[];
  if(b.cover_i) a.push(`https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg?default=false`);
  if(b.isbn) for(const isbn of (Array.isArray(b.isbn)?b.isbn:[b.isbn]).slice(0,3)) a.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
  return a;
}
function fallbackCover(b){
  const colors=['#6257ee','#e78a32','#168a68','#c84c68','#2d75b7','#6e5a91','#a35f34','#3d5a80'];
  const c=colors[(b.id||0)%colors.length];
  const initials=(b.name||'BOOK').split(/\s+/).slice(0,3).map(x=>x[0]).join('').toUpperCase();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="100%" height="100%" fill="${c}"/><circle cx="500" cy="100" r="120" fill="rgba(255,255,255,.12)"/><text x="55" y="580" fill="white" font-family="Arial" font-size="46" font-weight="700">${escapeHtml(initials)}</text><text x="55" y="640" fill="white" font-family="Arial" font-size="22">BOOKLY EDITION</text></svg>`)};`;
}
function imageHtml(b, cls='book-cover'){
  const urls=coverCandidates(b);
  const first=urls[0]||fallbackCover(b);
  return `<img class="${cls}" src="${first}" alt="Bìa sách ${escapeHtml(b.name)}" loading="lazy" data-cover-index="0" data-cover-urls='${JSON.stringify(urls).replace(/'/g,'&#39;')}' data-fallback="${fallbackCover(b)}" onerror="coverError(this)">`;
}
function coverError(img){
  let urls=[];try{urls=JSON.parse(img.dataset.coverUrls||'[]')}catch{}
  const i=Number(img.dataset.coverIndex||0)+1;
  if(i<urls.length){img.dataset.coverIndex=i;img.src=urls[i];return;}
  img.onerror=null;img.src=img.dataset.fallback;
}

function priceFor(key){
  let h=0; for(const ch of String(key)) h=(h*31+ch.charCodeAt(0))>>>0;
  return 79000+(h%17)*10000;
}
function normalizeDoc(d,cat){
  const name=d.title?.trim(); if(!name) return null;
  const author=(d.author_name?.[0]||'Chưa cập nhật').trim();
  const key=d.key||`${name}-${author}`;
  const uniq=name.toLowerCase()+author.toLowerCase();
  if(loadedKeys.has(uniq)) return null;
  loadedKeys.add(uniq);
  const isbn=(d.isbn||[]).find(x=>String(x).length===13)||d.isbn?.[0]||'';
  return {id:safeId(key),key,name,author,cat,price:priceFor(key),old:priceFor(key)+20000,isbn,cover_i:d.cover_i,year:d.first_publish_year,edition_count:d.edition_count,subject:d.subject?.slice(0,8)||[]};
}

async function fetchCatalogPage(){
  if(loading||catalogExhausted) return;
  loading=true; setLoading(true);
  const group=CATEGORY_QUERIES[(page-1)%CATEGORY_QUERIES.length];
  const apiPage=Math.floor((page-1)/CATEGORY_QUERIES.length)+1;
  const url=`https://openlibrary.org/search.json?q=${encodeURIComponent(group[1])}&page=${apiPage}&limit=100&fields=key,title,author_name,cover_i,isbn,first_publish_year,edition_count,subject`;
  try{
    const res=await fetch(url,{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error('API '+res.status);
    const data=await res.json();
    const added=(data.docs||[]).map(d=>normalizeDoc(d,group[0])).filter(Boolean);
    books.push(...added);
    if((data.docs||[]).length<100) { if(apiPage>20) catalogExhausted=true; }
    page++;
    renderProducts();
  }catch(e){
    console.warn('BOOKLY catalog load:',e);
    showToast('Không tải thêm được lúc này. Các sách đã có vẫn hoạt động.');
  }finally{loading=false;setLoading(false)}
}
function setLoading(on){const x=document.getElementById('loadMore');if(x)x.innerHTML=on?'⏳ Đang tải thêm sách…':'Tải thêm 100 cuốn →';}

function bookStory(b){
  const cat=b.cat||'tri thức';
  const year=b.year?` Từ dấu mốc xuất bản ${b.year}, cuốn sách tiếp tục tìm được những độc giả mới.`:'';
  const prompts={
    'Văn học':`Một người đọc mở ${b.name} vào một buổi tối bình thường. Chỉ vài trang sau, câu chuyện bắt đầu kéo họ ra khỏi nhịp sống quen thuộc và đặt họ trước những con người, lựa chọn và cảm xúc khác. Đó là kiểu cuốn sách khiến trang cuối khép lại nhưng câu hỏi vẫn ở lại.`,
    'Kinh tế':`${b.name} bắt đầu như một câu hỏi rất thực tế: làm thế nào để hiểu tiền bạc, công việc và những quyết định có ảnh hưởng dài hạn? Qua góc nhìn của ${b.author}, người đọc có thể biến những ý tưởng trừu tượng thành những câu hỏi gần với đời sống và công việc hơn.`,
    'Marketing':`Trong câu chuyện của ${b.name}, một ý tưởng chỉ thật sự có giá trị khi nó chạm được đến một con người cụ thể. ${b.author} đưa người đọc đi qua những vấn đề về khách hàng, thương hiệu và cách tạo ra giá trị — như một cuộc trò chuyện giữa người làm kinh doanh và thị trường.`,
    'Kỹ năng':`Có một ngày người đọc nhận ra mình không thiếu mục tiêu, chỉ thiếu một cách bắt đầu. ${b.name} trở thành điểm khởi đầu cho hành trình đó: từng ý tưởng được kéo về những hành động nhỏ, để kiến thức không nằm yên trên trang giấy mà đi vào lịch làm việc và cuộc sống.`,
    'Tâm lý':`${b.name} mở ra một cuộc trò chuyện với chính mình. Từ những hành vi tưởng như rất quen thuộc, ${b.author} gợi người đọc nhìn lại cách con người suy nghĩ, cảm nhận và đưa ra lựa chọn. Mỗi chương giống như một chiếc gương nhỏ đặt đúng vào một góc của tâm trí.`,
    'Ngoại ngữ':`Câu chuyện của ${b.name} là câu chuyện của những lần thử rồi sai. Mỗi từ mới, cấu trúc hay ví dụ trở thành một viên gạch nhỏ. Sau đủ nhiều viên gạch, người học bắt đầu nhận ra mình không còn dịch từng câu nữa — mình đang thật sự sử dụng ngôn ngữ.`,
    'Khoa học':`${b.name} bắt đầu bằng sự tò mò. Một câu hỏi tưởng đơn giản mở ra một chuỗi khám phá về thế giới, con người hoặc công nghệ. Với ${b.author}, người đọc được mời bước qua ranh giới giữa “biết một điều” và “hiểu vì sao điều đó xảy ra”.`,
    'Lịch sử':`Mỗi trang của ${b.name} là một cánh cửa nhìn về một thời điểm khác. Những con người và sự kiện trong sách không chỉ nằm ở quá khứ; chúng giúp người đọc đặt câu hỏi vì sao xã hội hôm nay lại được hình thành như vậy.`,
    'Thiếu nhi':`Một buổi đọc sách bắt đầu bằng vài phút yên tĩnh, rồi trí tưởng tượng của người đọc nhỏ tuổi tự mở ra. ${b.name} được BOOKLY giới thiệu như một người bạn đồng hành cho những giờ khám phá, đặt câu hỏi và kể lại thế giới bằng góc nhìn riêng.`,
    'Nghệ thuật':`${b.name} kể một câu chuyện bằng hình ảnh, ý tưởng và cảm giác. Người đọc bước vào thế giới của ${b.author} để nhìn một tác phẩm không chỉ như một sản phẩm đẹp, mà như kết quả của lựa chọn, kỹ thuật và một cách nhìn riêng.`,
    'Công nghệ':`Từ một vấn đề tưởng chỉ dành cho chuyên gia, ${b.name} mở ra một con đường dễ tiếp cận hơn. ${b.author} dẫn người đọc qua những khái niệm, công cụ và câu hỏi đang thay đổi cách con người làm việc với công nghệ.`,
    'Triết học':`${b.name} không vội đưa ra câu trả lời. Nó bắt đầu bằng một câu hỏi, rồi một câu hỏi khác xuất hiện. Cuộc hành trình cùng ${b.author} vì thế giống một cuộc đối thoại kéo dài — nơi người đọc được quyền dừng lại và tự hình thành quan điểm của mình.`,
    'Du lịch':`Có những cuốn sách khiến người đọc muốn mở bản đồ ngay lập tức. ${b.name} là một lời mời như vậy: từ những địa điểm, món ăn và trải nghiệm, người đọc được khuyến khích nhìn thế giới bằng đôi mắt tò mò hơn.`,
    'Giáo dục':`${b.name} bắt đầu từ một lớp học, một người học hoặc một người thầy đang tìm cách làm điều gì đó tốt hơn. ${b.author} đưa ra những ý tưởng để việc học trở nên có mục đích, dễ hiểu và gắn với sự phát triển lâu dài.`
  };
  return (prompts[cat]||`BOOKLY chọn ${b.name} như một điểm dừng cho những người yêu ${cat}. Qua góc nhìn của ${b.author}, người đọc có thể mở ra một chủ đề mới và tìm thấy một cách nhìn khác.`)+year;
}

function renderProducts(){
  const grid=document.getElementById('productGrid'); if(!grid)return;
  const q=(document.getElementById('searchInput')?.value||query).toLowerCase().trim();
  const list=books.filter(b=>(!filter||b.cat===filter)&&(!q||(b.name+' '+b.author+' '+b.cat+' '+(b.isbn||'')).toLowerCase().includes(q)));
  document.getElementById('resultText').textContent=`${list.length.toLocaleString('vi-VN')} sách đang hiển thị`;
  document.getElementById('catalogStats').textContent=`10.000+ đầu sách · đang tải theo nhu cầu · ${books.length.toLocaleString('vi-VN')} cuốn đã nạp`;
  grid.innerHTML=list.slice(0,80).map(b=>cardHtml(b)).join('') || '<div class="no-results">Không tìm thấy sách phù hợp. Hãy thử từ khóa khác.</div>';
  updateFavoriteCount();
}
function cardHtml(b){
  const active=favorites.has(String(b.id));
  return `<article class="card"><div class="card-media">${b.tag?`<div class="tag">${escapeHtml(b.tag)}</div>`:''}<button class="heart ${active?'active':''}" aria-label="Yêu thích" onclick="toggleFavorite('${String(b.id).replace(/'/g,"\\'")}')">${active?'♥':'♡'}</button><div onclick="openDetail('${String(b.id).replace(/'/g,"\\'")}')">${imageHtml(b)}</div></div><h3 title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</h3><p class="author">${escapeHtml(b.author)}</p><div class="rating">★★★★★ <span>4.8</span></div><div class="price"><strong>${money(b.price)}</strong><span class="old">${money(b.old)}</span></div><div class="card-actions"><button class="add" onclick="addCart('${String(b.id).replace(/'/g,"\\'")}')">＋ Thêm vào giỏ</button><button class="story-btn" onclick="openDetail('${String(b.id).replace(/'/g,"\\'")}')">Câu chuyện</button></div></article>`;
}
function getBook(id){return books.find(b=>String(b.id)===String(id));}

function filterCat(c){filter=c;document.getElementById('searchInput').value='';renderProducts();document.getElementById('books').scrollIntoView({behavior:'smooth'});}
function resetFilter(){filter='';document.getElementById('searchInput').value='';renderProducts();}
function searchBooks(){query=document.getElementById('searchInput').value;filter='';renderProducts();}

function toggleFavorite(id){
  id=String(id); if(favorites.has(id)){favorites.delete(id);showToast('Đã bỏ khỏi yêu thích')}else{favorites.add(id);showToast('♥ Đã thêm vào yêu thích')}
  saveJSON('bookly_favorites',[...favorites]);renderProducts();updateFavoriteCount();
}
function showFavorites(){
  filter='__FAVORITES__'; document.getElementById('searchInput').value='';
  const list=books.filter(b=>favorites.has(String(b.id)));
  document.getElementById('resultText').textContent=`${list.length} sách trong yêu thích`;
  document.getElementById('catalogStats').textContent='Danh sách yêu thích được lưu trên thiết bị này';
  document.getElementById('productGrid').innerHTML=list.map(cardHtml).join('')||'<div class="no-results">♡<br><br>Bạn chưa lưu cuốn sách nào.<br>Nhấn trái tim trên mỗi cuốn sách để lưu lại.</div>';
  document.getElementById('books').scrollIntoView({behavior:'smooth'});
}
function updateFavoriteCount(){const x=document.getElementById('favoriteBadge');if(x)x.textContent=favorites.size;const btn=document.getElementById('favoriteCountText');if(btn)btn.textContent=favorites.size;}

function addCart(id){id=String(id);cart[id]=(cart[id]||0)+1;saveJSON('bookly_cart',cart);updateCart();showToast('✓ Đã thêm sách vào giỏ hàng')}
function changeQty(id,n){id=String(id);cart[id]=(cart[id]||0)+n;if(cart[id]<=0)delete cart[id];saveJSON('bookly_cart',cart);updateCart();}
function deleteCart(id){delete cart[String(id)];saveJSON('bookly_cart',cart);updateCart();}
function updateCart(){document.getElementById('cartBadge').textContent=Object.values(cart).reduce((a,b)=>a+b,0);renderCart();}
function renderCart(){
  const ids=Object.keys(cart).filter(id=>cart[id]>0),list=document.getElementById('cartList');
  if(!ids.length){list.innerHTML='<div class="empty">🛒<br><br>Giỏ hàng đang trống.<br>Hãy thêm một cuốn sách bạn thích nhé!</div>';document.getElementById('cartSummary').innerHTML='';return;}
  list.innerHTML=ids.map(id=>{const b=getBook(id);if(!b)return '';return `<div class="cart-item">${imageHtml(b,'mini-cover')}<div class="cart-info"><strong>${escapeHtml(b.name)}</strong><p>${money(b.price)}</p><div class="qty"><button onclick="changeQty('${id}',-1)">−</button><span>${cart[id]}</span><button onclick="changeQty('${id}',1)">+</button><button onclick="deleteCart('${id}')" class="trash">🗑</button></div></div></div>`}).join('');
  const sub=ids.reduce((s,id)=>{const b=getBook(id);return s+(b?b.price*cart[id]:0)},0),ship=sub>=300000?0:25000;
  document.getElementById('cartSummary').innerHTML=`<div class="cart-total"><div class="row"><span>Tạm tính</span><b>${money(sub)}</b></div><div class="row"><span>Vận chuyển</span><b>${ship?money(ship):'Miễn phí'}</b></div><div class="row total"><span>Tổng cộng</span><b>${money(sub+ship)}</b></div><button class="primary full" onclick="openCheckout()">Tiến hành thanh toán →</button></div>`;
}
function openCart(){document.getElementById('cartOverlay').classList.add('show');renderCart()}
function closeCart(){document.getElementById('cartOverlay').classList.remove('show')}

function openDetail(id){
  const b=getBook(id); if(!b)return;
  document.getElementById('detailContent').innerHTML=`<div class="detail-top"><span>📚 Câu chuyện & thông tin sách</span><button class="close" onclick="closeDetail()">×</button></div><div class="product-detail"><div>${imageHtml(b,'detail-cover')}</div><div class="detail"><div class="muted">${escapeHtml(b.cat)} ${b.year?'· '+b.year:''}</div><h2>${escapeHtml(b.name)}</h2><div class="muted">Tác giả: ${escapeHtml(b.author)}</div>${b.isbn?`<div class="muted">ISBN: ${escapeHtml(b.isbn)}</div>`:''}<div class="rating detail-rating">★★★★★ 4.8</div><div class="bigprice">${money(b.price)} <span class="old">${money(b.old)}</span></div><div class="story-box"><div class="story-label">✦ CÂU CHUYỆN RIÊNG CỦA CUỐN SÁCH</div><p>${escapeHtml(bookStory(b))}</p></div><ul><li>Giao hàng toàn quốc</li><li>Đóng gói cẩn thận</li><li>Đổi trả theo chính sách cửa hàng</li></ul><div class="detail-actions"><button class="primary" onclick="addCart('${String(b.id).replace(/'/g,"\\'")}');closeDetail()">Thêm vào giỏ hàng</button><button class="secondary" onclick="toggleFavorite('${String(b.id).replace(/'/g,"\\'")}')">${favorites.has(String(b.id))?'♥ Đã yêu thích':'♡ Yêu thích'}</button></div></div></div>`;
  document.getElementById('detailModal').classList.add('show');
}
function closeDetail(){document.getElementById('detailModal').classList.remove('show')}

function openPromos(){document.getElementById('promoGrid').innerHTML=promos.map(p=>`<div class="promo-card"><strong>${p.code}</strong><b>${p.title}</b><span>${p.note}</span><button onclick="copyPromo('${p.code}')">Sao chép mã</button></div>`).join('');document.getElementById('promoModal').classList.add('show')}
function closePromos(){document.getElementById('promoModal').classList.remove('show')}
function copyPromo(code){navigator.clipboard?.writeText(code);showToast('Đã sao chép mã '+code)}

function openCheckout(){
  if(!Object.keys(cart).length){showToast('Giỏ hàng đang trống');return}
  closeCart();renderCheckout();document.getElementById('checkoutModal').classList.add('show');
}
function closeCheckout(){document.getElementById('checkoutModal').classList.remove('show')}
function checkoutTotals(){
  const ids=Object.keys(cart).filter(id=>cart[id]>0),sub=ids.reduce((s,id)=>{const b=getBook(id);return s+(b?b.price*cart[id]:0)},0);
  let discount=0;const code=checkoutState.promo;
  const map={BOOK5:.05,BOOK10:.10,BOOK15:.15,BOOK20:.20,WELCOME10:.10,NEWBOOK:.12,STUDENT:.10,READMORE:.15,WEEKEND:.20};
  if(code&&map[code]) discount=Math.round(sub*map[code]);
  const ship=code==='FREESHIP'||sub>=300000?0:25000;
  return {sub,discount,ship,total:sub-discount+ship};
}
function renderCheckout(){
  const ids=Object.keys(cart).filter(id=>cart[id]>0),t=checkoutTotals();
  document.getElementById('checkoutItems').innerHTML=ids.map(id=>{const b=getBook(id);return `<div class="checkout-item"><span>${escapeHtml(b.name)} × ${cart[id]}</span><b>${money(b.price*cart[id])}</b></div>`}).join('');
  document.getElementById('checkoutSummary').innerHTML=`<div class="row"><span>Tạm tính</span><b>${money(t.sub)}</b></div><div class="row"><span>Giảm giá</span><b class="green">-${money(t.discount)}</b></div><div class="row"><span>Vận chuyển</span><b>${t.ship?money(t.ship):'Miễn phí'}</b></div><div class="row total"><span>Thanh toán</span><b>${money(t.total)}</b></div>`;
}
function applyPromo(){const code=document.getElementById('checkoutPromo').value.trim().toUpperCase();if(!promos.some(p=>p.code===code)){showToast('Mã khuyến mãi không hợp lệ');return}checkoutState.promo=code;renderCheckout();showToast('Đã áp dụng '+code)}
function placeOrder(e){
  e.preventDefault();
  const f=e.target; const data={name:f.name.value,phone:f.phone.value,address:f.address.value,payment:f.payment.value};
  if(!data.name||!data.phone||!data.address){showToast('Vui lòng điền đầy đủ thông tin');return}
  checkoutState.customer=data;const t=checkoutTotals();
  const order='BK'+Date.now().toString().slice(-8);localStorage.setItem('bookly_last_order',JSON.stringify({order,...checkoutState,total:t.total,createdAt:new Date().toISOString()}));
  cart={};saveJSON('bookly_cart',cart);updateCart();closeCheckout();
  document.getElementById('successContent').innerHTML=`<div class="success-icon">✓</div><h2>Đặt hàng thành công!</h2><p>Mã đơn hàng của bạn là <b>${order}</b>.</p><p class="muted">BOOKLY đã ghi nhận đơn hàng demo. Đây là website front-end nên chưa kết nối cổng thanh toán thật.</p><button class="primary full" onclick="closeSuccess()">Tiếp tục mua sách</button>`;
  document.getElementById('successModal').classList.add('show');
}
function closeSuccess(){document.getElementById('successModal').classList.remove('show')}

function openSupport(){document.getElementById('supportModal').classList.add('show')}
function closeSupport(){document.getElementById('supportModal').classList.remove('show')}
function openPolicy(type){document.getElementById('policyTitle').textContent={shipping:'Chính sách vận chuyển',returns:'Đổi trả & hoàn tiền',privacy:'Bảo mật thông tin'}[type]||'Chính sách BOOKLY';document.getElementById('policyBody').innerHTML={shipping:'<p>BOOKLY dự kiến xử lý đơn trong 1–2 ngày làm việc. Thời gian giao hàng phụ thuộc khu vực và đơn vị vận chuyển.</p><ul><li>Nội thành: dự kiến 1–2 ngày.</li><li>Tỉnh/thành khác: dự kiến 2–5 ngày.</li><li>Miễn phí vận chuyển cho đơn đủ điều kiện theo chương trình.</li></ul>',returns:'<p>Khách hàng có thể gửi yêu cầu hỗ trợ khi sách bị hư hỏng, sai sản phẩm hoặc thiếu sản phẩm. Vui lòng giữ nguyên tình trạng đóng gói và cung cấp ảnh khi liên hệ.</p><ul><li>Kiểm tra sách ngay khi nhận.</li><li>Liên hệ hỗ trợ càng sớm càng tốt.</li><li>Hoàn tiền thực tế cần được xử lý qua hệ thống thanh toán khi website được kết nối backend.</li></ul>',privacy:'<p>Thông tin trong biểu mẫu checkout chỉ được lưu cục bộ trên trình duyệt trong phiên demo. Phiên bản này chưa gửi dữ liệu lên máy chủ BOOKLY.</p>'}[type];document.getElementById('policyModal').classList.add('show')}
function closePolicy(){document.getElementById('policyModal').classList.remove('show')}
function showToast(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('show');clearTimeout(window.tt);window.tt=setTimeout(()=>x.classList.remove('show'),2400)}

window.addEventListener('scroll',()=>{if(window.innerHeight+window.scrollY>=document.body.offsetHeight-700)fetchCatalogPage()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();closeCart();closePromos();closeCheckout();closeSupport();closePolicy();closeSuccess()}});

// Initial UI
renderProducts();updateCart();updateFavoriteCount();
// Load a first remote page so the catalog quickly grows beyond the local seed.
fetchCatalogPage();
