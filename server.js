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
  let url = req.url === '/' ? '/index.html' : req.url

  if (url === '/debug') {
    const files = fs.readdirSync(__dirname).join(', ')
    const pkg = fs.existsSync(path.join(__dirname, 'package.json'))
      ? fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8').slice(0, 200)
      : 'no package.json'
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end(`__dirname: ${__dirname}\ncwd: ${process.cwd()}\nfiles: ${files}\npackage: ${pkg}`)
  }

  if (url.startsWith('/gun/')) {
    const gunPath = path.join(__dirname, 'node_modules', url)
    if (fs.existsSync(gunPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      return res.end(fs.readFileSync(gunPath))
    }
    res.writeHead(404)
    return res.end('Not found')
  }

  const filePath = path.join(__dirname, url)
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    return res.end(fs.readFileSync(filePath))
  }

  res.writeHead(404)
  res.end('Not found')
})

const gun = Gun({ web: server })

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DecentChat running on port ${PORT}`)
  console.log(`Files: ${fs.readdirSync(__dirname).join(', ')}`)
})
