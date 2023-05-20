async function main() {
  const signers = await ethers.getSigners()
  const artist = signers[0]
  console.log('Deploying base contract for artist addr:', artist.address)

  MoneyMakingOpportunityFactory = await ethers.getContractFactory('MoneyMakingOpportunity', artist)
  MMO = await MoneyMakingOpportunityFactory.deploy()
  await MMO.deployed()

  const MMOTokenURIFactory = await ethers.getContractFactory('MMOTokenURI', artist)
  MMOTokenURI = await MMOTokenURIFactory.deploy(MMO.address)
  await MMOTokenURI.deployed()


  await Promise.all([
    signers[1].sendTransaction({ to: MMO.address, value: ethers.utils.parseEther('0.03') }),
    signers[2].sendTransaction({ to: MMO.address, value: ethers.utils.parseEther('0.03') }),
    signers[3].sendTransaction({ to: MMO.address, value: ethers.utils.parseEther('0.03') }),
    signers[4].sendTransaction({ to: MMO.address, value: ethers.utils.parseEther('0.03') }),
  ])

  await MMO.connect(artist).unlock(MMOTokenURI.address)

  await Promise.all([
    MMO.connect(signers[1]).claim(),
    MMO.connect(signers[2]).claim(),
    // MMO.connect(signers[3]).claim(),
    MMO.connect(signers[4]).claim(),
  ])

  // await MMO.connect(signers[1]).castVote(1, 1, true)


  console.log(`MoneyMakingOpportunity:`, MMO.address)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });