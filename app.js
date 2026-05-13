let gun
let userPair
let contacts = {}
let currentContact = null
let messageStore = {}

const $ = id => document.getElementById(id)

window.onload = async () => {
  gun = Gun([location.origin + '/gun'])

  const stored = localStorage.getItem('decent-chat-pair')
  if (stored) {
    userPair = JSON.parse(stored)
    showChat()
  }

  $('register-btn').onclick = register
  $('login-btn').onclick = login
  $('send-btn').onclick = sendMessage
  $('message-input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }
  $('add-contact-btn').onclick = () => $('add-contact-modal').classList.remove('hidden')
  $('close-modal').onclick = () => $('add-contact-modal').classList.add('hidden')
  $('confirm-add-contact').onclick = addContact
  $('logout-btn').onclick = logout
  $('lookup-btn').onclick = lookupByUsername

  $('add-contact-modal').onclick = e => { if (e.target === $('add-contact-modal')) $('add-contact-modal').classList.add('hidden') }
}

async function register() {
  const username = $('username').value.trim()
  if (!username) return alert('Enter a username')

  const existing = await new Promise(resolve => {
    gun.get('usernames').get(username).once(resolve)
  })
  if (existing && existing.pub) return alert('Username taken')

  userPair = await SEA.pair()
  localStorage.setItem('decent-chat-pair', JSON.stringify(userPair))

  gun.get('users').get(userPair.pub).put({ username, pub: userPair.pub })
  gun.get('usernames').get(username).put({ pub: userPair.pub })

  showChat()
}

async function login() {
  const stored = localStorage.getItem('decent-chat-pair')
  if (!stored) return alert('No account found. Register first.')
  userPair = JSON.parse(stored)
  showChat()
}

function logout() {
  localStorage.removeItem('decent-chat-pair')
  location.reload()
}

async function showChat() {
  $('login-screen').classList.add('hidden')
  $('chat-screen').classList.remove('hidden')

  gun.get('users').get(userPair.pub).on(user => {
    if (user) $('user-display').textContent = '@' + user.username
  })

  loadContacts()
}

function loadContacts() {
  gun.get('contacts').get(userPair.pub).map().on((data, pub) => {
    if (!data || !data.pub) return
    contacts[data.pub] = data
    renderContacts()
    startMessageListener(data.pub)
  })
}

function renderContacts() {
  const list = $('contacts-list')
  list.innerHTML = ''
  Object.entries(contacts).forEach(([pub, c]) => {
    const div = document.createElement('div')
    div.className = 'contact-item' + (currentContact && currentContact.pub === pub ? ' active' : '')
    div.innerHTML = `
      <div class="contact-avatar">${(c.alias || '?')[0].toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(c.alias || pub.slice(0, 12) + '...')}</div>
        <div class="contact-pub-small">${pub.slice(0, 16)}...</div>
      </div>`
    div.onclick = () => selectContact(c)
    list.appendChild(div)
  })
}

function selectContact(contact) {
  currentContact = contact
  renderContacts()
  updateChatArea()
}

function updateChatArea() {
  const header = $('chat-header')
  const messages = $('chat-messages')
  const inputArea = $('chat-input-area')

  if (!currentContact) {
    header.innerHTML = '<div class="welcome-title">DecentChat</div><div class="welcome-sub">Select a contact to start chatting</div>'
    messages.innerHTML = ''
    inputArea.classList.add('hidden')
    return
  }

  inputArea.classList.remove('hidden')
  const alias = currentContact.alias || currentContact.pub.slice(0, 16) + '...'
  header.innerHTML = `
    <div>
      <div class="contact-chat-name">${escapeHtml(alias)}</div>
      <div class="contact-chat-pub">${currentContact.pub.slice(0, 24)}...</div>
    </div>`

  const chatId = getChatId(userPair.pub, currentContact.pub)
  renderMessages(chatId)
}

function getChatId(pub1, pub2) {
  return [pub1, pub2].sort().join('_')
}

function startMessageListener(contactPub) {
  const chatId = getChatId(userPair.pub, contactPub)
  if (messageStore[chatId] && messageStore[chatId]._listening) return
  if (!messageStore[chatId]) messageStore[chatId] = { _listening: true }

  gun.get('chats').get(chatId).get('messages').map().on(async (msg, msgId) => {
    if (!msg || !msg.encrypted || !msg.from || !msg.timestamp) return
    if (messageStore[chatId][msgId]) return

    const theirPub = msg.from === userPair.pub ? contactPub : msg.from
    const secret = await SEA.secret(theirPub, userPair).catch(() => null)
    if (!secret) return

    const text = await SEA.decrypt(msg.encrypted, secret).catch(() => null)
    if (!text) return

    messageStore[chatId][msgId] = { text, timestamp: msg.timestamp, from: msg.from }

    if (currentContact && getChatId(userPair.pub, currentContact.pub) === chatId) {
      renderMessages(chatId)
    }
  })
}

function renderMessages(chatId) {
  const container = $('chat-messages')
  container.innerHTML = ''

  const msgs = messageStore[chatId] || {}
  const entries = Object.entries(msgs).filter(([k]) => k !== '_listening')
  const sorted = entries.map(([, v]) => v).sort((a, b) => a.timestamp - b.timestamp)

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-chat">Send a message to start chatting</div>'
    return
  }

  sorted.forEach(msg => {
    const div = document.createElement('div')
    div.className = 'message ' + (msg.from === userPair.pub ? 'sent' : 'received')
    div.innerHTML = `
      <div class="msg-text">${escapeHtml(msg.text)}</div>
      <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`
    container.appendChild(div)
  })

  container.scrollTop = container.scrollHeight
}

function escapeHtml(text) {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

async function sendMessage() {
  const input = $('message-input')
  const text = input.value.trim()
  if (!text || !currentContact) return
  input.value = ''

  const chatId = getChatId(userPair.pub, currentContact.pub)
  const secret = await SEA.secret(currentContact.pub, userPair)
  const encrypted = await SEA.encrypt(text, secret)
  const msgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  gun.get('chats').get(chatId).get('messages').get(msgId).put({
    from: userPair.pub,
    encrypted,
    timestamp: Date.now(),
  })
}

async function addContact() {
  const pubInput = $('contact-pub-input')
  const aliasInput = $('contact-alias-input')
  const pubKey = pubInput.value.trim()
  const displayName = aliasInput.value.trim() || pubKey.slice(0, 8)
  if (!pubKey) return alert('Enter a public key')

  const user = await new Promise(resolve => {
    gun.get('users').get(pubKey).once(resolve)
  })
  if (!user || !user.pub) return alert('User not found. Have they registered?')

  gun.get('contacts').get(userPair.pub).get(pubKey).put({
    pub: pubKey,
    alias: displayName,
    added: Date.now(),
  })

  pubInput.value = ''
  aliasInput.value = ''
  $('add-contact-modal').classList.add('hidden')
}

async function lookupByUsername() {
  const username = $('contact-username-lookup').value.trim()
  if (!username) return

  const data = await new Promise(resolve => {
    gun.get('usernames').get(username).once(resolve)
  })

  const result = $('lookup-result')
  if (data && data.pub) {
    $('contact-pub-input').value = data.pub
    $('contact-alias-input').value = username
    result.textContent = 'Found: ' + data.pub.slice(0, 20) + '...'
    result.className = 'success'
  } else {
    result.textContent = 'User not found'
    result.className = 'error'
  }
}
