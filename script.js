const USERS_URL = "https://jsonplaceholder.typicode.com/users";
const POSTS_URL = "https://jsonplaceholder.typicode.com/posts";
const COMMENTS_URL = "https://jsonplaceholder.typicode.com/comments";

// PASTE YOUR OPENROUTER KEY HERE
const OPENROUTER_API_KEY = "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";

let users = [], posts = [], comments = [], commentsLoaded = false;
let liked = new Set(), retweeted = new Set(), following = new Set();
let currentProfileId = 1; // Leanne Graham= logged-in user
let chatHistory = [];

const feedEl = document.getElementById("feed");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("errorMsg");

function getUser(id){ return users.find(u => u.id === id); }
function initials(name){ return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function avatarColor(name){ const colors=["#cfe8ff","#d5f5e3","#fdebd0","#f5d6ff","#ffdfd3"]; let s=0; for(let c of name) s+=c.charCodeAt(0); return colors[s%colors.length]; }

async function loadData(){
  try{
    console.log("Users I got",users)
    console.log("Post I got",posts)
    loadingEl.classList.remove("hidden");
    const [usersRes, postsRes] = await Promise.all([fetch(USERS_URL), fetch(POSTS_URL)]);
    if(!usersRes.ok || !postsRes.ok) throw new Error("Failed to fetch");
    users = await usersRes.json();
    posts = await postsRes.json();
    posts = posts.slice(0, 20); // show first 20 like design
    loadingEl.classList.add("hidden");
    renderFeed(posts, feedEl);
    renderWhoToFollow();
    showProfile(currentProfileId, false);
  } catch(err){
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.textContent = "Failed to load feed. Check your network and refresh.";
  }
}

async function loadComments(){
  if(commentsLoaded) return;
  const res = await fetch(COMMENTS_URL);
  comments = await res.json();
  commentsLoaded = true;
}

function renderFeed(list, container){
  container.innerHTML = "";
  list.forEach(post => {
    const user = getUser(post.userId) || { name: "Unknown", username: "unknown" };
    const count = comments.filter(c => c.postId === post.id).length;
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <div class="avatar" style="background:${avatarColor(user.name)}" data-user="${user.id}">${initials(user.name)}</div>
      <div class="post-body">
        <div><b class="post-name" data-user="${user.id}">${user.name}</b> @${user.username}</div>
        <p><b>${post.title}</b></p>
        <p>${post.body}</p>
        <div class="post-actions">
          <button data-comments="${post.id}">Comments (${count})</button>
          <button data-like="${post.id}" class="${liked.has(post.id)?'liked':''}"> Like ${liked.has(post.id)?1:0}</button>
          <button data-rt="${post.id}"> ${retweeted.has(post.id)?'Retweeted':'Retweet'}</button>
          <button data-summary="${post.id}">Summarize with AI</button>
        </div>
        <div id="comments-${post.id}"></div>
      </div>`;
    container.appendChild(div);
  });

  // Click handling for whole feed
  container.onclick = async (e) => {
    const userBtn = e.target.closest("[data-user]");
    const comBtn = e.target.closest("[data-comments]");
    const likeBtn = e.target.closest("[data-like]");
    const rtBtn = e.target.closest("[data-rt]");
    const sumBtn = e.target.closest("[data-summary]");
    if(userBtn){ showProfile(Number(userBtn.dataset.user), true); return; }
    if(likeBtn){ const id=Number(likeBtn.dataset.like); liked.has(id)?liked.delete(id):liked.add(id); renderFeed(posts, feedEl); if(!document.getElementById("profileView").classList.contains("hidden")) showProfile(currentProfileId,false); return; }
    if(rtBtn){ const id=Number(rtBtn.dataset.rt); retweeted.has(id)?retweeted.delete(id):retweeted.add(id); renderFeed(posts, feedEl); return; }
    if(comBtn){ await loadComments(); const id=Number(comBtn.dataset.comments); const box=document.getElementById(`comments-${id}`); if(box.innerHTML){ box.innerHTML=""; return; } const list=comments.filter(c=>c.postId===id); box.innerHTML=list.map(c=>`<div class="comment"><b>${c.name}</b> <small>${c.email}</small><br>${c.body}</div>`).join(""); return; }
    if(sumBtn){ const id=Number(sumBtn.dataset.summary); const p=posts.find(x=>x.id===id); const postComments=comments.filter(c=>c.postId===id); openAI(); sendToAI(`Summarize this post: Title: ${p.title}. Body: ${p.body}. Comments: ${postComments.map(c=>c.body).join(" | ")}`); return; }
  };
}

function renderWhoToFollow(){
  const el = document.getElementById("whoToFollow");
  el.innerHTML = users.slice(1,3).map(u=>`
    <div class="follow-card" data-user="${u.id}">
      <div class="avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
      <div><b>${u.name}</b><br>@${u.username}</div>
    </div>`).join("");
  el.onclick = e => { const c=e.target.closest("[data-user]"); if(c) showProfile(Number(c.dataset.user), true); };
}

function showProfile(userId, switchView){
  currentProfileId = userId;
  const u = getUser(userId); if(!u) return;
  document.getElementById("profileAvatar").textContent = initials(u.name);
  document.getElementById("profileAvatar").style.background = avatarColor(u.name);
  document.getElementById("profileName").textContent = u.name;
  document.getElementById("profileUsername").textContent = "@"+u.username;
  document.getElementById("profileBio").textContent = `Coffee first, code second. Building small things with JavaScript and Multi-Model AI.`;
  document.getElementById("profileMeta").textContent = `Works at ${u.company.name} | ${u.address.city}`;
  document.getElementById("profileStats").innerHTML = `<b>${224+userId}</b> Following &nbsp; <b>${2930+userId*10}</b> Followers &nbsp; <b>${posts.filter(p=>p.userId===userId).length}</b> Posts`;
  document.getElementById("followBtn").textContent = following.has(userId) ? "Following" : "Follow";
  document.getElementById("profilePostsTitle").textContent = `Posts by ${u.name.split(" ")[0]}`;
  renderFeed(posts.filter(p=>p.userId===userId), document.getElementById("profilePosts"));
  if(switchView) showView("profile");
}

// Navigation
function showView(view){
  document.getElementById("homeView").classList.toggle("hidden", view!=="home");
  document.getElementById("profileView").classList.toggle("hidden", view!=="profile");
  document.getElementById("pageTitle").textContent = view==="profile" ? "Profile" : "Home";
  if(view==="ai") openAI();
}
document.getElementById("navHome").onclick = ()=>showView("home");
document.getElementById("navProfile").onclick = ()=>{ showProfile(currentProfileId, false); showView("profile"); };
document.getElementById("navAI").onclick = ()=>openAI();
document.querySelectorAll(".bottombar button").forEach(b=>b.onclick=()=>{
  const v=b.dataset.nav; if(v==="ai") openAI(); else if(v==="profile"){ showProfile(currentProfileId,false); showView("profile"); } else showView("home");
});
document.getElementById("followBtn").onclick = (e)=>{
  if(following.has(currentProfileId)) following.delete(currentProfileId); else following.add(currentProfileId);
  e.target.textContent = following.has(currentProfileId) ? "Following" : "Follow";
};

// Compose
const tweetInput = document.getElementById("tweetInput");
tweetInput.addEventListener("input", ()=> document.getElementById("charCount").textContent = `${280 - tweetInput.value.length} left`);
document.getElementById("tweetBtn").onclick = ()=>{
  const text = tweetInput.value.trim(); if(!text) return;
  const newPost = { id: Date.now(), userId: currentProfileId, title: text, body: "" };
  posts.unshift(newPost);
  tweetInput.value=""; document.getElementById("charCount").textContent="280 left";
  renderFeed(posts, feedEl);
};

// AI Chat
function openAI(){ document.getElementById("aiPanel").classList.remove("hidden"); }
function closeAI(){
  document.getElementById("aiPanel").classList.add("hidden");
  
  // 1. Delete all messages on the screen
  document.getElementById("chatMessages").innerHTML = "";
  
  // 2. Delete all messages in memory
  // Keep only the first one - the one that says "talk in simple English"
  chatHistory = [chatHistory[0]];
  
  // 3. Delete what you typed in the input box
  document.getElementById("aiInput").value = "";
}
document.getElementById("aiFab").onclick = openAI;
document.getElementById("closeAI").onclick = closeAI;

function addMsg(text, who){
  const box=document.getElementById("chatMessages");
  const d=document.createElement("div"); d.className=`msg ${who}`; d.textContent=text; box.appendChild(d); box.scrollTop=box.scrollHeight;
}

async function sendToAI(userText){
  if(!OPENROUTER_API_KEY || OPENROUTER_API_KEY==="YOUR_OPENROUTER_KEY_HERE"){ addMsg("Please add your OpenRouter API key in script.js to use AI.", "ai"); return; }
  addMsg(userText, "user");
  chatHistory.push({ role:"user", content:userText });
  document.getElementById("thinking").classList.remove("hidden");
  try{
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{ "Authorization":`Bearer ${OPENROUTER_API_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model:"openrouter/free", messages: chatHistory })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error?.message || "AI request failed");
    const reply = data.choices[0].message.content;
    chatHistory.push({ role:"assistant", content: reply });
    addMsg(reply, "ai");
  } catch(e){ addMsg("Error: "+e.message, "ai"); }
  finally{ document.getElementById("thinking").classList.add("hidden"); }
}
document.getElementById("sendAI").onclick = ()=>{ const v=document.getElementById("aiInput").value.trim(); if(!v) return; document.getElementById("aiInput").value=""; sendToAI(v); };

loadData();