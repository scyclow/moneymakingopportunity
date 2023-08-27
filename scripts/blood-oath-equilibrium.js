const TOTAL_PIRATES = 12
const TOTAL_BOOTY = 100
const INCREMENT = 0.01


function calcVotesNeeded(piratesRemaining) {
  return Math.ceil(piratesRemaining/2 - 1)
}

function equillibriumForPiratesRemaining(piratesRemaining) {
  if (piratesRemaining === 1) return new Proposal([
    TOTAL_BOOTY
  ])

  if (piratesRemaining === 2) return new Proposal([
    TOTAL_BOOTY + INCREMENT,
    TOTAL_BOOTY - INCREMENT
  ])

  const lowerProposal = equillibriumForPiratesRemaining(piratesRemaining - 1) // P-1

  const votesNeeded = calcVotesNeeded(piratesRemaining) // V
  const votesNeededNextRound = piratesRemaining === TOTAL_PIRATES // V+
    ? 1
    : calcVotesNeeded(piratesRemaining + 1)


  const newProposals = {}
  let allocatedBooty = 0
  let votesSecured = 0

  times(votesNeeded, v => {
    const { pirate, offer } = lowerProposal.offersLowToHigh[v]

    const newOffer = offer + INCREMENT
    allocatedBooty += newOffer
    votesSecured += 1

    newProposals[pirate] = newOffer
  })

  let proposalsLowToHigh = sortProposalsLowToHigh(newProposals)

  const unallocatedBooty = TOTAL_BOOTY - allocatedBooty
  const unallocatedPirates = piratesRemaining - votesNeeded
  const avgRemainingAllocation = unallocatedBooty / unallocatedPirates
  // const piratesWithLesserOffers = Object.keys(newProposals).reduce((sum, key) => newProposals[key], 0)

  // maximize my personal offer such that:
    // V offers are higher than equivalent offers in P-1
    // there are V+ - 1 offers lower than me

}


class Proposal {
  constructor(values) {
    this.pirateToOffer = {}

    times(TOTAL_PIRATES, p => this.pirateToOffer[p] = pirateToOffer[p] || 0)


    this.offersLowToHigh = Object.keys(this.pirateToOffer)
      .map(pirate => ({
        pirate,
        offer: this.pirateToOffer[pirate]
      }))
      .sort((a, b) => a.offer - b.offer)

    this.offersHighToLow = Object.keys(this.pirateToOffer)
      .map(pirate => ({
        pirate,
        offer: this.pirateToOffer[pirate]
      }))
      .sort((a, b) => b.offer - a.offer)
  }
}

function sortProposalsHighToLow(proposals) {
  return Object.keys(this.pirateToOffer)
    .map(pirate => ({
      pirate,
      offer: this.pirateToOffer[pirate]
    }))
    .sort((a, b) => a.offer - b.offer)
}

function sortProposalsLowToHigh(proposals) {
  return Object.keys(this.pirateToOffer)
    .map(pirate => ({
      pirate,
      offer: this.pirateToOffer[pirate]
    }))
    .sort((a, b) => b.offer - a.offer)
}

function times(t, fn) {
  const out = []
  for (let i = 0; i < t; i++) out.push(fn(i))
  return out
}