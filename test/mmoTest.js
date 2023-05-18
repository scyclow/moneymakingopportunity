const { expect, use } = require('chai')
const { ethers, waffle } = require('hardhat')
const { expectRevert, time, snapshot } = require('@openzeppelin/test-helpers')



const toETH = amt => ethers.utils.parseEther(String(amt))
const bidAmount = amt => ({ value: toETH(amt) })
const num = n => Number(ethers.utils.formatEther(n))
const _num = n => n.toString()

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



    const MoneyMakingOpportunityFactory = await ethers.getContractFactory('MoneyMakingOpportunity', artist)
    MMO = await MoneyMakingOpportunityFactory.deploy()
    await MMO.deployed()
  })

  describe('constructor', () => {
    it('should work', async () => {
      expect(await MMO.connect(artist).isLocked()).to.equal(true)
      expect(await MMO.connect(artist).startTime()).to.equal(0)
      expect(await MMO.connect(artist).settlementTime()).to.equal(0)
      expect(await MMO.connect(artist).currentPeriod()).to.equal(0)
      expect(await MMO.connect(artist).totalSupply()).to.equal(1)
    })
  })

  describe('contribution phase', () => {
    it('should remain locked until unlocked', async () => {
      await time.increase(60*60*24*7*2) // two weeks
      expect(await MMO.connect(artist).currentPeriod()).to.equal(0)
      expect(await MMO.connect(artist).startTime()).to.equal(0)

      await signers[1].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})

      await MMO.connect(artist).unlock(zeroAddr)
      expect(await MMO.connect(artist).isLocked()).to.equal(false)
      const startTime = _num(await time.latest())

      expect(_num(await MMO.connect(artist).startTime())).to.equal(startTime)

      expect(await MMO.connect(artist).currentPeriod()).to.equal(1)
      await time.increase(60*60*24*7) // one week
      expect(await MMO.connect(artist).currentPeriod()).to.equal(2)
    })

    it('should only allow artist to unlock', async () => {
      await expectRevert(
        MMO.connect(signers[1]).unlock(zeroAddr),
        'Ownable: caller is not the owner'
      )
    })

    it('should not allow multiple unlocking', async () => {
      await MMO.connect(artist).unlock(zeroAddr)

      await expectRevert(MMO.connect(artist).unlock(zeroAddr), '1')
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
        value: ethers.utils.parseEther('0.0299')
      })

      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.0299')
      })

      expect(await MMO.connect(artist).totalSupply()).to.equal(10)
    })

    it('should not update totalSupply after unlocked', async () => {
      expect(await MMO.connect(artist).totalSupply()).to.equal(1)
      await signers[1].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})
      await MMO.connect(artist).unlock(zeroAddr)

      await signers[2].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})
      await signers[3].sendTransaction({to: MMO.address, value: ethers.utils.parseEther('0.03')})

      expect(await MMO.connect(artist).totalSupply()).to.equal(2)
    })

    it('should not allow minting', async () => {
      await signers[1].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.03')
      })

      await expectRevert(MMO.connect(signers[1]).mint(), '2')
    })

    it('should mint token 0 to artist without affecting totalSupply', async () => {
      expect(await MMO.connect(artist).totalSupply()).to.equal(1)
      expect(await MMO.connect(artist).exists(0)).to.equal(false)

      await MMO.connect(artist).unlock(zeroAddr)

      expect(await MMO.connect(artist).totalSupply()).to.equal(1)
      expect(await MMO.connect(artist).exists(0)).to.equal(true)
      expect(await MMO.connect(artist).ownerOf(0)).to.equal(artist.address)
    })
  })

  describe('minting', () => {
    it('should allow everyone who contributed >= 0.03 at once to mint', async () => {
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
        value: ethers.utils.parseEther('0.0299')
      })

      await signers[10].sendTransaction({
        to: MMO.address,
        value: ethers.utils.parseEther('0.0299')
      })

      await MMO.connect(artist).unlock(zeroAddr)


      await Promise.all(times(9, async i => {
        const s = signers[i+1]
        expect(await MMO.connect(s).exists(i+1)).to.equal(false)
        await MMO.connect(s).mint()
        expect(await MMO.connect(s).exists(i+1)).to.equal(true)
        expect(await MMO.connect(s).ownerOf(i+1)).to.equal(s.address)

        await expectRevert(
          MMO.connect(s).mint(),
          'ERC721: token already minted'
        )
      }))

      expect(await MMO.connect(signers[10]).exists(10)).to.equal(false)
      await expectRevert(
        MMO.connect(signers[10]).mint(),
        'ERC721: token already minted'
      )
      expect(await MMO.connect(artist).ownerOf(0)).to.equal(artist.address)
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

      await MMO.connect(artist).unlock(zeroAddr)

      expect(await MMO.connect(artist).currentPeriod()).to.equal(1)
      expect(await MMO.connect(artist).totalSupply()).to.equal(10)
      expect(await MMO.connect(artist).leaderToken()).to.equal(9)
      expect(await MMO.connect(artist).exists(10)).to.equal(false)

      for (let i = 1; i <= 10; i++) {
        expect(await MMO.connect(artist).currentPeriod()).to.equal(i)
        expect(await MMO.connect(artist).leaderToken()).to.equal(10 - i)
        await time.increase(60*60*24*7) // one week
      }
      await time.increase(60*60*24*7*10) // 10 weeks
      expect(await MMO.connect(artist).leaderToken()).to.equal(0)
    })
  })

  describe('currentPeriod', () => {
    it('should be 0 while locked, 1 - n for all participant weeks, and n afterwards', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      expect(await MMO.connect(artist).currentPeriod()).to.equal(0)

      await MMO.connect(artist).unlock(zeroAddr)

      expect(await MMO.connect(artist).currentPeriod()).to.equal(1)

      for (let i = 1; i <= 10; i++) {
        expect(await MMO.connect(artist).currentPeriod()).to.equal(i)
        await time.increase(60*60*24*7) // one week
      }

      await time.increase(60*60*24*365) // ~ one year
      expect(await MMO.connect(artist).currentPeriod()).to.equal(10)
    })

    it('should stop at settlement period', async () => {
      await Promise.all(times(10, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await MMO.connect(artist).unlock(zeroAddr)

      await Promise.all(times(10, i => MMO.connect(signers[i+1]).mint()))

      await time.increase(60*60*24*7 * 5)

      expect(await MMO.connect(artist).currentPeriod()).to.equal(6)


      // week 6
      await MMO.connect(signers[0]).castVote(0, 6, true)
      await MMO.connect(signers[1]).castVote(1, 6, true)
      await MMO.connect(signers[2]).castVote(2, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[3]).castVote(3, 6, true)
      await MMO.connect(signers[4]).castVote(4, 6, true)

      await MMO.connect(signers[5]).commitPaymentAddressProposal(5, zeroAddr)
      await MMO.connect(signers[5]).settlePayment()

      await time.increase(60*60*24*7 * 10) //10 more weeks

      expect(await MMO.connect(artist).currentPeriod()).to.equal(6)
    })
  })

  describe('isEliminated', () => {
    it('should eliminate each leader as their period passes', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      await MMO.connect(artist).unlock(zeroAddr)

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

  describe.only('tokenIdToPeriod', () => {
    it('should be correct', async () => {
      await Promise.all(times(9, i =>
        signers[i+1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })
      ))

      expect(await MMO.connect(artist).tokenIdToPeriod(9)).to.equal(1)
      expect(await MMO.connect(artist).tokenIdToPeriod(8)).to.equal(2)
      expect(await MMO.connect(artist).tokenIdToPeriod(7)).to.equal(3)
      expect(await MMO.connect(artist).tokenIdToPeriod(6)).to.equal(4)
      expect(await MMO.connect(artist).tokenIdToPeriod(5)).to.equal(5)
      expect(await MMO.connect(artist).tokenIdToPeriod(4)).to.equal(6)
      expect(await MMO.connect(artist).tokenIdToPeriod(3)).to.equal(7)
      expect(await MMO.connect(artist).tokenIdToPeriod(2)).to.equal(8)
      expect(await MMO.connect(artist).tokenIdToPeriod(1)).to.equal(9)
      expect(await MMO.connect(artist).tokenIdToPeriod(0)).to.equal(10)
    })
  })

  describe('voting', () => {
    describe.only('castVote', () => {
      it('should cast a vote', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(zeroAddr)

        await MMO.connect(signers[1]).mint()

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

        await MMO.connect(artist).unlock(zeroAddr)

        await MMO.connect(signers[1]).mint()

        await expectRevert(
          MMO.connect(signers[2]).castVote(1, 1, true),
          '4'
        )
      })

      it('should not work for previous periods', async () => {
        signers[1].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        signers[2].sendTransaction({
          to: MMO.address,
          value: ethers.utils.parseEther('0.03')
        })

        await MMO.connect(artist).unlock(zeroAddr)
        await time.increase(60*60*24*7) // one week

        await MMO.connect(signers[1]).mint()

        expect(await MMO.connect(artist).currentPeriod()).to.equal(2)

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

        await MMO.connect(artist).unlock(zeroAddr)
        await MMO.connect(signers[1]).mint()
        await MMO.connect(signers[2]).mint()

        await MMO.connect(signers[0]).castVote(0, 1, true)

        await MMO.connect(signers[2]).settlePayment()

        await expectRevert(
          MMO.connect(signers[1]).castVote(1, 1, true),
          '9'
        )
      })
    })

    describe.only('calculateVotes', () => {
      it('should calculate all valid votes', async () => {
        await Promise.all(times(9, async i =>
          signers[i+1].sendTransaction({
            to: MMO.address,
            value: ethers.utils.parseEther('0.03')
          })
        ))

        await MMO.connect(artist).unlock(zeroAddr)
        await Promise.all(times(9, i => MMO.connect(signers[i+1]).mint()))

        for (let i = 0; i < 10; i++) {
          for (let j = 1; j < 10; j++) {
            await MMO.connect(signers[i]).castVote(i, j, true)
          }
        }

        await Promise.all(times(10, async i => {
          const expectedYayVotes = String(10 - i)
          const votes1 = await MMO.connect(signers[1]).calculateVotes(i+1)

          expect(_num(votes1[0])).to.equal(expectedYayVotes)
          expect(_num(votes1[1])).to.equal('0')
        }))
      })

    })


  })
})