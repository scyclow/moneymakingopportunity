
const express = require('express')
const hardhat = require('hardhat')

const app = express()

app.get('/:tokenId', async (req, res) => {
  try {
    // will recompile if there are changes
    await hardhat.run('compile')

    // Grab SVG content from renderer
    // const Strings = await hardhat.ethers.getContractFactory('Strings')
    // const Base64 = await hardhat.ethers.getContractFactory('Base64')

    // const str = await Strings.deploy().then(strings => strings.deployed())
    // const b64 = await Base64.deploy().then(base64 => base64.deployed())

    const MMOFactory = await hardhat.ethers.getContractFactory('MMOMock', {
      // libraries: { Strings: str.address, Base64: b64.address }
    })

    const MMO = await MMOFactory.deploy()
    await MMO.deployed()

    MMOTokenURIFactory = await hardhat.ethers.getContractFactory('MMOTokenURI')


    const MMOTokenURI = await MMOTokenURIFactory.deploy(MMO.address)
    await MMOTokenURI.deployed()

    console.log(MMO.address)
    console.log(MMOTokenURI.address)


    console.log('>>>>>>>>>>>>>>>>>>>>>>>>')
    const tokenURI = await MMOTokenURI.tokenURI(Number(req.params.tokenId) || 0)


    const tokenURIStr = tokenURI.replace('data:application/json;utf8,', '')
    console.log(tokenURIStr, '<<<')
    const encodedSVG = JSON.parse(tokenURIStr).image.replace('data:image/svg+xml;base64,', '')
    const decodedSVG = Buffer.from(encodedSVG, 'base64').toString('utf8')

    // Will refresh every 1 second
    res.send(`
      <html>
      <head>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            background: yellow;
          }

          svg {

          }
        </style>
      </head>
      <body>
      ${decodedSVG}
      </body>
      <style>body{margin:0;padding:0;}</style>
      <script>console.log(JSON.parse(\`${tokenURIStr}\`))</script>
      </html>
    `)
  } catch (e) {
    // in case you grab compiler errors
    res.send(`
      <html>
        <head>

        </head>
          ${e}
      </html>
  `)
  }
})

const PORT = process.env.PORT || 5005
app.listen(PORT, () => {
  console.log(`Serving SVG on port ${PORT}`)
})