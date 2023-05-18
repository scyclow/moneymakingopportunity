async function main() {
  const [artist, collector1, collector2, collector3] = await ethers.getSigners()
  console.log('Deploying base contract for artist addr:', artist.address)

  MoneyMakingOpportunityFactory = await ethers.getContractFactory('MoneyMakingOpportunity', artist)
  MoneyMakingOpportunity = await MoneyMakingOpportunityFactory.deploy()
  await MoneyMakingOpportunity.deployed()


  console.log(`MoneyMakingOpportunity:`, MoneyMakingOpportunity.address)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });