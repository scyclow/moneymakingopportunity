const { expect, use } = require('chai')
const { ethers, waffle } = require('hardhat')
const { expectRevert, time, snapshot } = require('@openzeppelin/test-helpers')



const toETH = amt => ethers.utils.parseEther(String(amt))
const bidAmount = amt => ({ value: toETH(amt) })
const num = n => Number(ethers.utils.formatEther(n))
const _num = n => n.toString()

const utf8Clean = raw => raw.replace(/data.*utf8,/, '')
const b64Clean = raw => raw.replace(/data.*,/, '')
const b64Decode = raw => Buffer.from(b64Clean(raw), 'base64').toString('utf8')
const getJsonURI = rawURI => JSON.parse(utf8Clean(rawURI))
const getSVG = rawURI => b64Decode(JSON.parse(utf8Clean(rawURI)).image)

function times(t, fn) {
  const out = []
  for (let i = 0; i < t; i++) {
    out.push(fn(i))
  }
  return out
}


const zeroAddr = '0x0000000000000000000000000000000000000000'
const safeTransferFrom = 'safeTransferFrom(address,address,uint256)'


describe('MoneyMakingOpportunity', () => {
  let MMO
  let signers, artist, contributor1, contributor2, contributor3, contributor4

  beforeEach(async () => {
    signers = await ethers.getSigners()
    artist = signers[0]

    banker = await ethers.getImpersonatedSigner('0x47144372eb383466D18FC91DB9Cd0396Aa6c87A4')

    await banker.sendTransaction({
      to: signers[0].address,
      value: ethers.utils.parseEther('1')
    })

    await Promise.all(times(10, i => banker.sendTransaction({
      to: signers[i+1].address,
      value: ethers.utils.parseEther('0.05')
    })))



    const MMOFactory = await ethers.getContractFactory('MoneyMakingOpportunity', artist)
    MMO = await MMOFactory.deploy()
    await MMO.deployed()

    const MMOTokenURIFactory = await ethers.getContractFactory('MMOTokenURI', artist)
    MMOTokenURI = await MMOTokenURIFactory.deploy(MMO.address)
    await MMOTokenURI.deployed()
  })

  describe('constructor', () => {
    it('should work', async () => {
      expect(await MMO.connect(artist).isLocked()).to.equal(true)
      expect(await MMO.connect(artist).beginning()).to.equal(0)
      expect(await MMO.connect(artist).ending()).to.equal(0)
      expect(await MMO.connect(artist).currentWeek()).to.equal(0)
      expect(await MMO.connect(artist).contributors()).to.equal(1)
    })
  })

  describe('contribution phase', () => {
    it('should remain locked until unlocked', async () => {
      await time.increase(60*60*24*7*2) // two weeks
      expect(await MMO.connect(artist).currentWeek()).to.equal(0)
      expect(await MMO.connect(artist).beginning()).to.equal(0)

      await signers[1].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})

      expect(await MMO.connect(artist).isLocked()).to.equal(true)
      expect(await MMO.connect(artist).tokenURIContract()).to.equal(zeroAddr)

      await MMO.connect(artist).unlock(MMOTokenURI.address)
      expect(await MMO.connect(artist).isLocked()).to.equal(false)
      expect(await MMO.connect(artist).tokenURIContract()).to.equal(MMOTokenURI.address)

      const beginning = _num(await time.latest())

      expect(_num(await MMO.connect(artist).beginning())).to.equal(beginning)

      expect(await MMO.connect(artist).currentWeek()).to.equal(1)
      await time.increase(60*60*24*7) // one week
      expect(await MMO.connect(artist).currentWeek()).to.equal(2)
    })

    it('should only allow artist to unlock', async () => {
      await expectRevert(
        MMO.connect(signers[1]).unlock(MMOTokenURI.address),
        '11'
      )
    })

    it('should not allow multiple unlocking', async () => {
      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await expectRevert(MMO.connect(artist).unlock(MMOTokenURI.address), '1')
    })

    it('should allow contributions of any amount, but only increase total supply when >= 0.03', async () => {
      await Promise.all(times(8, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await signers[9].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.04')
      })

      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.015')
      })

      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.015')
      })

      await signers[11].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.0299')
      })

      expect(await MMO.connect(artist).contributors()).to.equal(11)
    })

    it('should not update contributors after unlocked', async () => {
      expect(await MMO.connect(artist).contributors()).to.equal(1)
      await signers[1].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})
      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await signers[2].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})
      await signers[3].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})

      expect(await MMO.connect(artist).contributors()).to.equal(2)
    })

    it('should not allow minting', async () => {
      await signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await expectRevert(MMO.connect(signers[1]).claim(), '2')
    })

    it('should mint token 0 to artist without affecting contributors', async () => {
      expect(await MMO.connect(artist).contributors()).to.equal(1)
      expect(await MMO.connect(artist).exists(0)).to.equal(false)

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      expect(await MMO.connect(artist).contributors()).to.equal(1)
      expect(await MMO.connect(artist).exists(0)).to.equal(true)
      expect(await MMO.connect(artist).ownerOf(0)).to.equal(artist.address)
    })
  })

  describe('minting', () => {
    it('should allow everyone who contributed >= 0.03 to mint', async () => {
      await Promise.all(times(8, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.0299')
      })

      await signers[9].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.04')
      })


      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.0299')
      })

      await MMO.connect(artist).unlock(MMOTokenURI.address)


      await Promise.all(times(9, async i => {
        const s = signers[i+1]
        expect(await MMO.connect(s).exists(i+1)).to.equal(false)
        await MMO.connect(s).claim()
        expect(await MMO.connect(s).exists(i+1)).to.equal(true)
        expect(await MMO.connect(s).ownerOf(i+1)).to.equal(s.address)

        await expectRevert(
          MMO.connect(s).claim(),
          'Already minted'
        )
      }))

      expect(await MMO.connect(signers[10]).exists(10)).to.equal(false)
      await expectRevert(
        MMO.connect(signers[11]).claim(),
        'Already minted'
      )
      expect(await MMO.connect(artist).ownerOf(0)).to.equal(artist.address)
    })

    it('shouldnt mint the correct token number if they contribute multiple times', async () => {
      await signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.02')
      })

      await signers[2].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })


      await signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.02')
      })

      await signers[3].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await signers[2].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await Promise.all(times(3, i => MMO.connect(signers[i+1]).claim()))

      expect(await MMO.connect(artist).ownerOf(1)).to.equal(signers[2].address)
      expect(await MMO.connect(artist).ownerOf(2)).to.equal(signers[1].address)
      expect(await MMO.connect(artist).ownerOf(3)).to.equal(signers[3].address)
      expect(await MMO.connect(artist).exists(4)).to.equal(false)
    })

    it('should mint tokens with the correct attributes', async () => {
      await signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await signers[2].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await signers[3].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await MMO.connect(signers[3]).claim()

      const tokenURI3 = getJsonURI(await MMO.connect(signers[3]).tokenURI(3))

      expect(tokenURI3.name).to.equal('Money Making Opportunity #3 (Week 1/4)')
      expect(tokenURI3.external_url).to.equal('https://steviep.xyz/moneymakingopportunity')
      expect(tokenURI3.description.includes('4 participants')).to.equal(true)
      expect(tokenURI3.attributes.length).to.equal(3)
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Opportunity ID').value).to.equal('3')
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Leadership Week').value).to.equal('1')
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal('None')

      const tokenURI0 = getJsonURI(await MMO.connect(signers[0]).tokenURI(0))
      expect(tokenURI0.name).to.equal('Money Making Opportunity #0 (Week 4/4)')
      expect(tokenURI0.attributes.length).to.equal(3)
      expect(tokenURI0.attributes.find(a => a.trait_type === 'Opportunity ID').value).to.equal('0')
      expect(tokenURI0.attributes.find(a => a.trait_type === 'Leadership Week').value).to.equal('4')
      expect(tokenURI0.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal('None')

    })
  })

  describe('leaderToken', () => {
    it('should start at the last token, end at 0, and stay at 0', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      expect(await MMO.connect(artist).leaderToken()).to.equal(0)

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      expect(await MMO.connect(artist).currentWeek()).to.equal(1)
      expect(await MMO.connect(artist).contributors()).to.equal(10)
      expect(await MMO.connect(artist).leaderToken()).to.equal(9)
      expect(await MMO.connect(artist).exists(10)).to.equal(false)

      for (let i = 1; i <= 10; i++) {
        expect(await MMO.connect(artist).currentWeek()).to.equal(i)
        expect(await MMO.connect(artist).leaderToken()).to.equal(10 - i)
        await time.increase(60*60*24*7) // one week
      }
      await time.increase(60*60*24*7*10) // 10 weeks
      expect(await MMO.connect(artist).leaderToken()).to.equal(0)
    })

    it('should remain the same token after settled', async () => {
      await Promise.all(times(10, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await Promise.all(times(10, i => MMO.connect(signers[i+1]).claim()))

      await time.increase(60*60*24*7 * 5)

      expect(await MMO.connect(artist).leaderToken()).to.equal(5)

      // week 6
      await MMO.connect(signers[0]).castVote(0, 6, true)
      await MMO.connect(signers[1]).castVote(1, 6, true)
      await MMO.connect(signers[2]).castVote(2, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[4]).castVote(4, 6, true)

      await MMO.connect(signers[5]).proposeSettlementAddress(6, zeroAddr)
      await MMO.connect(signers[5]).settlePayment()

      await time.increase(60*60*24*7 * 10) //10 more weeks

      expect(await MMO.connect(artist).leaderToken()).to.equal(5)
    })
  })

  describe('currentWeek', () => {
    it('should be 0 while locked, 1 - n for all participant weeks, and n afterwards', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      expect(await MMO.connect(artist).currentWeek()).to.equal(0)

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      expect(await MMO.connect(artist).currentWeek()).to.equal(1)

      for (let i = 1; i <= 10; i++) {
        expect(await MMO.connect(artist).currentWeek()).to.equal(i)
        await time.increase(60*60*24*7) // one week
      }

      await time.increase(60*60*24*365) // ~ one year
      expect(await MMO.connect(artist).currentWeek()).to.equal(10)
    })

    it('should stop at settlement week', async () => {
      await Promise.all(times(10, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await Promise.all(times(10, i => MMO.connect(signers[i+1]).claim()))

      await time.increase(60*60*24*7 * 5)

      expect(await MMO.connect(artist).currentWeek()).to.equal(6)


      // week 6
      await MMO.connect(signers[0]).castVote(0, 6, true)
      await MMO.connect(signers[1]).castVote(1, 6, true)
      await MMO.connect(signers[2]).castVote(2, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[4]).castVote(4, 6, true)

      await MMO.connect(signers[5]).proposeSettlementAddress(6, zeroAddr)
      await MMO.connect(signers[5]).settlePayment()

      await time.increase(60*60*24*7 * 10) //10 more weeks

      expect(await MMO.connect(artist).currentWeek()).to.equal(6)
    })
  })

  describe('isEliminated', () => {
    it('should eliminate each leader as their week passes', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await MMO.connect(artist).unlock(MMOTokenURI.address)

      expect(await MMO.connect(artist).isEliminated(9)).to.equal(false)

      for (let i = 1; i <= 9; i++) {
        expect(await MMO.connect(artist).isEliminated(10-i)).to.equal(false)
        await time.increase(60*60*24*7) // one week
        expect(await MMO.connect(artist).isEliminated(10-i)).to.equal(true)
      }

      await time.increase(60*60*24*7 * 10) //10 more weeks
      expect(await MMO.connect(artist).isEliminated(0)).to.equal(false)
    })
  })

  describe('tokenIdToWeek', () => {
    it('should be correct', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      expect(await MMO.connect(artist).tokenIdToWeek(9)).to.equal(1)
      expect(await MMO.connect(artist).tokenIdToWeek(8)).to.equal(2)
      expect(await MMO.connect(artist).tokenIdToWeek(7)).to.equal(3)
      expect(await MMO.connect(artist).tokenIdToWeek(6)).to.equal(4)
      expect(await MMO.connect(artist).tokenIdToWeek(5)).to.equal(5)
      expect(await MMO.connect(artist).tokenIdToWeek(4)).to.equal(6)
      expect(await MMO.connect(artist).tokenIdToWeek(3)).to.equal(7)
      expect(await MMO.connect(artist).tokenIdToWeek(2)).to.equal(8)
      expect(await MMO.connect(artist).tokenIdToWeek(1)).to.equal(9)
      expect(await MMO.connect(artist).tokenIdToWeek(0)).to.equal(10)
    })
  })

  describe('voting', () => {
    describe('castVote', () => {
      it('should cast a vote', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)

        await MMO.connect(signers[1]).claim()

        await expectRevert(
          MMO.connect(signers[2]).castVote(1, 1, true),
          '4'
        )

        expect(await MMO.connect(signers[1]).votes(1, 1)).to.equal(false)

        await MMO.connect(signers[1]).castVote(1, 1, true)

        const votes1 = await MMO.connect(signers[1]).calculateVotes(1)

        expect(await MMO.connect(signers[1]).votes(1, 1)).to.equal(true)
        expect(_num(votes1[0])).to.equal('2')
        expect(_num(votes1[1])).to.equal('1')


        await MMO.connect(signers[1]).castVote(1, 1, false)
        const votes2 = await MMO.connect(signers[1]).calculateVotes(1)

        expect(await MMO.connect(signers[1]).votes(1, 1)).to.equal(false)
        expect(_num(votes2[0])).to.equal('1')
        expect(_num(votes2[1])).to.equal('2')
      })

      it('should not let non owner cast vote', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)

        await MMO.connect(signers[1]).claim()

        await expectRevert(
          MMO.connect(signers[2]).castVote(1, 1, true),
          '4'
        )
      })

      it('should handle token transfers', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)
        await MMO.connect(signers[1]).claim()
        await MMO.connect(signers[2]).claim()

        await MMO.connect(signers[1]).castVote(1, 1, true)
        await MMO.connect(signers[1])[safeTransferFrom](signers[1].address, signers[2].address, 1)

        const calcVotes1 = await MMO.connect(artist).calculateVotes(1)
        expect(await MMO.connect(artist).votes(1, 1)).to.equal(true)
        expect(_num(calcVotes1[0])).to.equal('2')

        await MMO.connect(signers[2]).castVote(1, 1, false)

        const calcVotes2 = await MMO.connect(artist).calculateVotes(1)
        expect(await MMO.connect(artist).votes(1, 1)).to.equal(false)
        expect(_num(calcVotes2[0])).to.equal('1')
      })

      it('should not work for previous weeks', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)
        await time.increase(60*60*24*7) // one week

        await MMO.connect(signers[1]).claim()

        expect(await MMO.connect(artist).currentWeek()).to.equal(2)

        await expectRevert(
          MMO.connect(signers[1]).castVote(1, 1, true),
          '5'
        )
      })

      it('should not work if settled', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)
        await MMO.connect(signers[1]).claim()
        await MMO.connect(signers[2]).claim()

        await MMO.connect(signers[0]).castVote(0, 1, true)

        await MMO.connect(signers[2]).settlePayment()

        await expectRevert(
          MMO.connect(signers[1]).castVote(1, 1, true),
          '9'
        )
      })

      it('should not work for weeks after tokens week', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[3].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(MMOTokenURI.address)

        await MMO.connect(signers[2]).claim()

        await MMO.connect(signers[2]).castVote(2, 1, true)
        await MMO.connect(signers[0]).castVote(0, 3, true)

        await expectRevert(
          MMO.connect(signers[2]).castVote(2, 3, true),
          '12'
        )
      })
    })

    describe('calculateVotes', () => {
      it('should calculate all valid votes', async () => {
        await Promise.all(times(9, async i =>
          signers[i+1].sendTransaction({
            to: MMO.address,
            value: ethers.utils.parseEther('0.03')
          })
        ))

        await MMO.connect(artist).unlock(MMOTokenURI.address)
        await Promise.all(times(9, i => MMO.connect(signers[i+1]).claim()))

        await MMO.connect(signers[1]).castVote(1, 1, true)
        await MMO.connect(signers[1]).castVote(1, 1, true)
        await MMO.connect(signers[1]).castVote(1, 1, true)


        const votes0 = await MMO.connect(signers[1]).calculateVotes(1)

        expect(_num(votes0[0])).to.equal('2')
        expect(_num(votes0[1])).to.equal('8')

        await MMO.connect(signers[1]).castVote(1, 1, false)
        await MMO.connect(signers[1]).castVote(1, 1, false)

        const votes1 = await MMO.connect(signers[1]).calculateVotes(1)
        expect(_num(votes1[0])).to.equal('1')
        expect(_num(votes1[1])).to.equal('9')

        for (let i = 0; i < 10; i++) {
          for (let j = 1; j < 10 - i; j++) {
            await MMO.connect(signers[i]).castVote(i, j, true)
          }
        }

        await Promise.all(times(10, async i => {
          const expectedYayVotes = String(10 - i)
          const votes2 = await MMO.connect(artist).calculateVotes(i+1)

          expect(_num(votes2[0])).to.equal(expectedYayVotes)
          expect(_num(votes2[1])).to.equal('0')
        }))
      })
    })
  })

  describe('proposeSettlementAddress', () => {
    const proposedAddr = '0x1234000000000000000000000000000000000000'

    beforeEach(async () => {
      signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      signers[2].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      signers[3].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      signers[4].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await Promise.all(times(4, i => MMO.connect(signers[i+1]).claim()))

    })

    it('should set a payment address proposal for token', async () => {
      expect(await MMO.connect(artist).settlementAddressProposals(2)).to.equal(zeroAddr)
      expect(await MMO.connect(artist).settlementAddressProposals(1)).to.equal(zeroAddr)

      await MMO.connect(signers[4]).proposeSettlementAddress(1, proposedAddr)
      expect(await MMO.connect(artist).settlementAddressProposals(1)).to.equal(proposedAddr)
      await time.increase(60*60*24*7) // one week

      await MMO.connect(signers[3]).proposeSettlementAddress(2, proposedAddr)
      expect(await MMO.connect(artist).settlementAddressProposals(2)).to.equal(proposedAddr)

      const tokenURI2 = getJsonURI(await MMO.connect(signers[2]).tokenURI(2))
      const tokenURI3 = getJsonURI(await MMO.connect(signers[3]).tokenURI(3))
      const tokenURI4 = getJsonURI(await MMO.connect(signers[4]).tokenURI(4))

      expect(tokenURI2.attributes.length).to.equal(3)
      expect(tokenURI2.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal('None')

      expect(tokenURI3.attributes.length).to.equal(3)
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal(proposedAddr)

      expect(tokenURI4.attributes.length).to.equal(3)
      expect(tokenURI4.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal(proposedAddr)

    })

    it('should error if called by non token owner', async () => {
      await expectRevert(MMO.connect(signers[4]).proposeSettlementAddress(2, proposedAddr), '4')
      await expectRevert(MMO.connect(signers[3]).proposeSettlementAddress(1, proposedAddr), '4')
    })

    it('should not be called multiple times', async () => {
      await MMO.connect(signers[4]).proposeSettlementAddress(1, proposedAddr)
      await expectRevert(MMO.connect(signers[4]).proposeSettlementAddress(1, zeroAddr), '7')
    })

    it('should error if called after token has been eliminated', async () => {
      await time.increase(60*60*24*7) // one week
      await expectRevert(MMO.connect(signers[4]).proposeSettlementAddress(1, proposedAddr), '6')

      await MMO.connect(signers[3]).proposeSettlementAddress(2, proposedAddr)
      expect(await MMO.connect(artist).settlementAddressProposals(2)).to.equal(proposedAddr)
    })
  })

  describe('settlement', () => {
    const proposedAddr1 = '0x1234000000000000000000000000000000000000'
    const proposedAddr2 = '0x5678000000000000000000000000000000000000'

    beforeEach(async () => {
      signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      signers[2].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      signers[3].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })


      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await Promise.all(times(3, i => MMO.connect(signers[i+1]).claim()))

      await MMO.connect(signers[3]).proposeSettlementAddress(1, proposedAddr1)
      await MMO.connect(signers[2]).proposeSettlementAddress(2, proposedAddr2)
    })


    it('should be callable if current week has > 50% yay votes', async () => {
      const startingDestinationBalance = num(await ethers.provider.getBalance(proposedAddr1))
      const startingContractBalance = num(await ethers.provider.getBalance(MMO.address))

      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[1]).castVote(1, 1, true)
      await MMO.connect(signers[2]).castVote(2, 1, true)

      await MMO.connect(signers[3]).settlePayment()

      const endingDestinationBalance = num(await ethers.provider.getBalance(proposedAddr1))
      const endingContractBalance = num(await ethers.provider.getBalance(MMO.address))

      expect(startingContractBalance).to.equal(0.09)
      expect(endingContractBalance).to.equal(0)

      expect(startingDestinationBalance).to.equal(0)
      expect(endingDestinationBalance).to.equal(0.09)
    })

    it('should be callable if current week has == 50% yay votes', async () => {
      const startingDestinationBalance = num(await ethers.provider.getBalance(proposedAddr1))

      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[3]).settlePayment()

      const endingDestinationBalance = num(await ethers.provider.getBalance(proposedAddr1))
      const endingContractBalance = num(await ethers.provider.getBalance(MMO.address))

      expect(endingContractBalance).to.equal(0)
      expect(endingDestinationBalance - startingDestinationBalance).to.equal(0.09)
    })

    it('should not be callable if current week has < 50% yay votes', async () => {
      expectRevert(MMO.connect(signers[3]).settlePayment(), '10')
    })

    it('should update tokenURI attributes', async () => {
      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[3]).settlePayment()

      const tokenURI0 = getJsonURI(await MMO.connect(signers[0]).tokenURI(0))
      const tokenURI1 = getJsonURI(await MMO.connect(signers[1]).tokenURI(1))
      const tokenURI2 = getJsonURI(await MMO.connect(signers[1]).tokenURI(2))
      const tokenURI3 = getJsonURI(await MMO.connect(signers[3]).tokenURI(3))


      expect(tokenURI0.attributes.length).to.equal(4)
      expect(tokenURI1.attributes.length).to.equal(4)
      expect(tokenURI2.attributes.length).to.equal(4)
      expect(tokenURI3.attributes.length).to.equal(4)

      expect(tokenURI0.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal('None')
      expect(tokenURI1.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal('None')
      expect(tokenURI2.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal(proposedAddr2)
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Proposed Settlement Address').value).to.equal(proposedAddr1)

      expect(tokenURI0.attributes.find(a => a.trait_type === 'Successful Settlement Vote').value).to.equal('True')
      expect(tokenURI1.attributes.find(a => a.trait_type === 'Successful Settlement Vote').value).to.equal('False')
      expect(tokenURI2.attributes.find(a => a.trait_type === 'Successful Settlement Vote').value).to.equal('False')
      expect(tokenURI3.attributes.find(a => a.trait_type === 'Successful Settlement Vote').value).to.equal('True')

    })

    it('should be callable by anyone', async () => {
      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[1]).castVote(1, 1, true)

      await MMO.connect(signers[6]).settlePayment()
    })

    it('should always resolve to currentWeek', async () => {

      await expectRevert(
        MMO.connect(signers[3]).settlePayment(),
        '10'
      )

      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[1]).castVote(1, 1, true)
      await time.increase(60*60*24*7) // one week

      await MMO.connect(signers[1]).castVote(1, 2, true)

      await MMO.connect(signers[2]).settlePayment()

      const endingDestinationBalance = num(await ethers.provider.getBalance(proposedAddr2))
      const endingContractBalance = num(await ethers.provider.getBalance(MMO.address))

      expect(endingContractBalance).to.equal(0)
      expect(endingDestinationBalance).to.equal(0.09)
    })

    it('should not be callable multiple times', async () => {
      await MMO.connect(signers[0]).castVote(0, 1, true)
      await MMO.connect(signers[1]).castVote(1, 1, true)

      await MMO.connect(signers[3]).settlePayment()
      await expectRevert(
        MMO.connect(signers[3]).settlePayment(),
        '8'
      )
    })

    it('should allow the 0th token to settle if everyone misses their week', async () => {
      const proposedAddr3 = '0x7777000000000000000000000000000000000000'

      await time.increase(60*60*24*7*25) // 25 weeks

      await MMO.connect(signers[0]).proposeSettlementAddress(4, proposedAddr3)


      await MMO.connect(signers[0]).settlePayment()

      expect(num(await ethers.provider.getBalance(proposedAddr3))).to.equal(0.09)
    })
  })

  describe('setURIContract', () => {
    it('should reset the uri contract', async () => {
      await MMO.connect(artist).unlock(zeroAddr)
      expect(await MMO.connect(artist).tokenURIContract()).to.equal(zeroAddr)

      await MMO.connect(artist).setURIContract(MMOTokenURI.address)
      expect(await MMO.connect(artist).tokenURIContract()).to.equal(MMOTokenURI.address)

      await MMO.connect(artist).setURIContract(zeroAddr)
      expect(await MMO.connect(artist).tokenURIContract()).to.equal(zeroAddr)
    })

    it('should not work for anyone other than the artist', async () => {
      await MMO.connect(artist).unlock(MMOTokenURI.address)

      await expectRevert(
        MMO.connect(signers[1]).setURIContract(zeroAddr),
        '11'
      )
    })

    it('should not work after it has been comitted', async () => {
      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await MMO.connect(artist).commitURI()

      await expectRevert(
        MMO.connect(artist).setURIContract(zeroAddr),
        '11'
      )
    })

    it('comitting should not work for anyone other than the artist', async () => {
      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await expectRevert(
        MMO.connect(signers[1]).commitURI(),
        '11'
      )
    })

    it('should not work if project is still locked', async () => {
      await expectRevert(
        MMO.connect(artist).commitURI(),
        '13'
      )
      await MMO.connect(artist).unlock(MMOTokenURI.address)
      await MMO.connect(artist).commitURI()
    })
  })
})