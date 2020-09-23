const https = require('https');
const http = require('http');

const requestListener = function (request, response) {
  var proxyData = ''

  request.on('data', function(chunk) {
    proxyData += chunk
  });

  request.on('end', function() {
    proxyData = JSON.parse(proxyData)

    if(!valid(proxyData)) {
      makeProxyResponse(500, JSON.stringify({
        status: "fail",
        message: "Incorrect data"
      }))
    } else {
      let httpType = checkHttpType(proxyData['url']);
      let connector = httpType === 'http' ? http : https
      let [hostname, port, path] = getUrlData(proxyData['url'], httpType)

      let lowerMethod = proxyData['method'].toLowerCase()
      if(lowerMethod === 'get') {
        let separator = path.indexOf('?') == -1 ? '?' : ''
        if(proxyData['data'] !== '') {
          path += separator + parseGetUrl(proxyData['data'])
        }
      } else if(lowerMethod === "post" || lowerMethod === "put") {
        proxyData['headers']['Content-Length'] = proxyData['data'].lenght
      }

      let options = {
        hostname: hostname,
        port: port,
        path: path,
        method: proxyData['method'],
        headers: proxyData['headers']
      }
      
      const proxyRequest = connector.request(options, destResponse => {
        let receivedData = ''

        destResponse.on('data', receivedChunk => {
          receivedData += receivedChunk
        })

        destResponse.on('end', function () {
          makeProxyResponse(destResponse.statusCode, receivedData)
        });
      })
      .on('error', console.error)
      .end(JSON.stringify(proxyData['data']))
      
      proxyRequest.on('error', error => {
        console.error(error)
      })
    }
  })

  response.setHeader('Content-Type', 'application/json')

  function makeProxyResponse(code, data) {
    response.writeHead(code)
    response.end(data)
  }
}

const server = http.createServer(requestListener)
server.listen(8080)

function valid(data) {
  let requireProperty = ['method', 'url']
  let optionalProperty  = ['headers', 'data']
  let params = Object.keys(data)
  for(let item of requireProperty) {
    if(!params.includes(item)) return true;
  }
  for(let item of optionalProperty) {
    if(!params.includes(item)) data[item] = ""
  }
  return true
}

function parseGetUrl(args) {
  let getParams = ''
  let paramsCount = Object.keys(args).length
  let index = 1
  for(let key in args) {
    getParams += key + '=' + args[key]
    if(index != paramsCount) getParams += '&'
    index++
  }
  return getParams
}

function checkHttpType(url) {
  if(url.indexOf('http://') === 0) return 'http'
  if(url.indexOf('https://') === 0) return 'https'
  return ""
}

function getUrlData(url, httpType) {
  let chunk
  if(url.indexOf('http') === 0) {
    chunk = url.substring(url.indexOf('/') + 2)
  }

  let hostname = ''
  let path = ''
  let port = httpType === 'http' ? 80 : 443
  let slashPosition = chunk.indexOf('/')
  if(slashPosition !== -1) {
    hostname = chunk.substring(0, slashPosition)
    path = chunk.substring(slashPosition)

    let portPosition = hostname.indexOf(':')
    if(portPosition !== -1) {
      port = hostname.substring(portPosition)
      hostname = hostname.substring(0, portPosition)
    }
  } else {
    hostname = chunk
  }

  return [hostname, port, path]
}
