import * as process from 'process'
import * as express from 'express'
import * as Url from 'url'

import * as ReactSSR from 'react-dom/server'
import * as typestyle from 'typestyle'

import * as csstips from 'csstips'

import * as png from './png'

import * as renderers from './render'

import {Image} from './ImageType'
export {Image}

csstips.normalize()
csstips.setupPage('body')

import * as fs from 'fs'

const lato = fs
  .readFileSync('node_modules/lato-font/fonts/lato-medium/lato-medium.woff2')
  .toString('base64')

function vnode_to_html(vnode: React.ReactElement<{}>): string {
  const body = ReactSSR.renderToStaticMarkup(vnode)
  const css = typestyle.getStyles()
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>#capture{display:inline-block;}${css}
        @font-face {
          font-family: "lato";
          src: url("data:font/woff2;base64,${lato}") format('woff2');
        }
        body{background:#fff; font-family: lato;}
        </style>
      </head>
      <body><div id="capture">${body}</div></body>
    </html>`
}

export async function ImageMaker<Data>(
  image: Image<Data>,
  renderer = renderers.makeChromeRenderer
) {
  const {render, cleanup} = await renderer()

  async function snap(query_string: string) {
    const data = image.string_to_data(query_string)
    const html = vnode_to_html(image.data_to_react(data))
    const buf = await render(html, '#capture')
    return png.onBuffer.set(image.key, data, buf)
  }

  return {snap, cleanup}
}

function req_to_string(url: string) {
  return decodeURIComponent(Url.parse(url).query || '')
}

export async function ImageServer<Data>(
  image: Image<Data>,
  port = parseInt(process.argv[2], 10) || 3000
) {
  const express_throttle = require('express-throttle')
  const options = {burst: 5, period: '1s'}
  const throttle = express_throttle(options)
  const app = express()

  try {
    app.get('/', (req, res) => {
      res.send(vnode_to_html(image.data_to_react(image.string_to_data(req_to_string(req.url)))))
    })

    const image_maker = await ImageMaker(image)

    app.get('/i.png', throttle, async (req, res) => {
      const png = await image_maker.snap(req_to_string(req.url))
      res.contentType('image/png')
      res.send(png)
    })

    const server = app.listen(port, () => console.log('Setting phasers to stun...'))

    async function cleanup() {
      console.log('closing...')
      image_maker.cleanup()
      server.close()
    }

    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  } catch (e) {
    console.error(e)
  }
}