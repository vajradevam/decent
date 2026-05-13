const Gun = require('gun')
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8765

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
}

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url
  const ext = path.extname(url)

  if (url.startsWith('/gun/')) {
    const gunPath = path.join(__dirname, 'node_modules', url)
    if (fs.existsSync(gunPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      return res.end(fs.readFileSync(gunPath))
    }
  }

  const filePath = path.join(__dirname, url)
  if (fs.existsSync(filePath) && ext) {
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    return res.end(fs.readFileSync(filePath))
  }

  res.writeHead(404)
  res.end('Not found')
})

const gun = Gun({ web: server })

server.listen(PORT, () => {
  console.log(`DecentChat running on http://localhost:${PORT}`)
})
