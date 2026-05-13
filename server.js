const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8765

const server = http.createServer((req, res) => {
  if (req.url === '/debug') {
    const info = [
      '__dirname: ' + __dirname,
      'cwd: ' + process.cwd(),
      'files: ' + fs.readdirSync(__dirname).join(', '),
      'cwd_files: ' + fs.readdirSync(process.cwd()).join(', '),
    ]
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end(info.join('\n'))
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end('<h1>Hello from DecentChat</h1>')
  }
  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
