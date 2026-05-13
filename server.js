const http = require('http')
const PORT = process.env.PORT || 8765
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end('<h1>Hello World</h1>')
}).listen(PORT, () => console.log('on', PORT))
